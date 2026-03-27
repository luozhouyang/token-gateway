import { and, eq } from "drizzle-orm";
import { createDatabase } from "../../storage/database.js";
import {
  llmModels,
  llmProviders,
  pluginLlmRouterCircuits,
  pluginLlmRouterRequestLogs,
} from "../../storage/schema.js";
import type { DatabaseClient } from "../../storage/types.js";
import { cloneArrayBuffer, toFetchRequest, type HttpRequestState } from "../runtime.js";
import {
  LlmModelResourceSchema,
  LlmProviderResourceSchema,
  LlmRouterConfigSchema,
  type LlmRouterPluginConfig,
} from "../llm/config.js";
import { getNormalizedLlmRequest, setNormalizedLlmRequest } from "../llm/context.js";
import { parseLlmModelReference } from "../llm/model-reference.js";
import {
  getProviderAdapter,
  type StoredLlmModel,
  type StoredLlmProvider,
} from "../llm/provider-adapters.js";
import { normalizeLlmRequest } from "../llm/normalized-request.js";
import { type LlmClientProfile, type NormalizedLlmRequest } from "../llm/types.js";
import type { PluginContext, PluginDefinition, PluginHandlerResult } from "../types.js";

type LlmRouterConfig = LlmRouterPluginConfig;
type CircuitState = "closed" | "open" | "half-open";

interface CircuitSnapshot {
  state: CircuitState;
  shouldSkip: boolean;
}

interface AttemptLogEntry {
  pluginId: string;
  requestId: string;
  clientType: LlmClientProfile;
  providerName: string;
  model: string | null;
  statusCode: number | null;
  latencyMs: number;
  failureReason: string | null;
}

interface LlmRouterStorage {
  getProviderByName(providerName: string): Promise<StoredLlmProvider | null>;
  getModelByProviderAndName(providerId: string, modelName: string): Promise<StoredLlmModel | null>;
  getCircuitState(input: {
    pluginId: string;
    providerName: string;
    now: number;
    openTimeoutMs: number;
  }): Promise<CircuitSnapshot>;
  markSuccess(input: {
    pluginId: string;
    providerName: string;
    now: number;
    successThreshold: number;
  }): Promise<void>;
  markFailure(input: {
    pluginId: string;
    providerName: string;
    now: number;
    failureThreshold: number;
    minimumRequests: number;
    errorRateThreshold: number;
  }): Promise<void>;
  logAttempt(input: AttemptLogEntry): Promise<void>;
}

export const LlmRouterPlugin: PluginDefinition = {
  name: "llm-router",
  version: "1.0.0",
  priority: 700,
  phases: ["access"],
  configSchema: LlmRouterConfigSchema,
  createStorage: (ctx) => createLlmRouterStorage(ctx.rawDb),

  onAccess: async (ctx: PluginContext): Promise<PluginHandlerResult> => {
    const config = normalizeConfig(ctx.config);
    const storage = getStorage(ctx);
    const baseRequest = cloneRequestState(ctx.request);
    const sharedNormalizedRequest = getNormalizedLlmRequest(ctx.shared);
    const clientProfile = resolveClientProfile(ctx, config, sharedNormalizedRequest);
    const normalizedRequest = resolveNormalizedRequest(
      baseRequest,
      clientProfile,
      sharedNormalizedRequest,
    );
    setNormalizedLlmRequest(ctx.shared, normalizedRequest);

    const parsedModelReference = parseLlmModelReference(normalizedRequest.model);
    if ("error" in parsedModelReference) {
      return badRequest(parsedModelReference.error);
    }

    const provider = await storage.getProviderByName(parsedModelReference.providerName);
    if (!provider) {
      return badRequest(`Unknown LLM provider "${parsedModelReference.providerName}"`);
    }
    if (!provider.enabled) {
      return unavailable(`LLM provider "${provider.name}" is disabled`);
    }

    const model = await storage.getModelByProviderAndName(
      provider.id,
      parsedModelReference.modelName,
    );
    if (!model) {
      return badRequest(
        `Unknown LLM model "${parsedModelReference.modelName}" for provider "${provider.name}"`,
      );
    }
    if (!model.enabled) {
      return unavailable(
        `LLM model "${parsedModelReference.modelName}" for provider "${provider.name}" is disabled`,
      );
    }

    const adapter = getProviderAdapter(provider.vendor);
    const maxAttempts = Math.max(1, config.maxRetries + 1);
    let lastFailureReason = "No available provider response";

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const now = Date.now();
      const circuit = await storage.getCircuitState({
        pluginId: ctx.plugin.id,
        providerName: provider.name,
        now,
        openTimeoutMs: config.circuitBreaker.openTimeoutMs,
      });

      if (circuit.shouldSkip) {
        await persistAttemptLog(storage, config, {
          pluginId: ctx.plugin.id,
          requestId: ctx.requestId,
          clientType: clientProfile,
          providerName: provider.name,
          model: normalizedRequest.model,
          statusCode: null,
          latencyMs: 0,
          failureReason: "circuit-open",
        });
        return unavailable(`LLM provider "${provider.name}" circuit is open`);
      }

      const builtAttempt = adapter.buildRequest({
        provider,
        model,
        normalizedRequest,
        baseRequest,
      });
      if ("error" in builtAttempt) {
        return badRequest(builtAttempt.error);
      }

      const request = cloneRequestState(builtAttempt.request);
      request.url = buildProviderUrl(provider.baseUrl, request.url.pathname, request.url.search);
      request.headers.delete("host");
      request.headers.delete("content-length");
      scrubAuthHeaders(request.headers);

      const resolvedAuth = resolveProviderAuth(provider);
      if (resolvedAuth) {
        if ("error" in resolvedAuth) {
          return unavailable(resolvedAuth.error);
        }

        request.headers.set(resolvedAuth.name, resolvedAuth.value);
      }

      for (const [key, value] of Object.entries(provider.headers)) {
        request.headers.set(key, value);
      }

      ctx.request = cloneRequestState(request);
      ctx.shared.set("llm-router.client", clientProfile);
      ctx.shared.set("llm-router.provider", provider.name);
      ctx.shared.set("llm-router.vendor", provider.vendor);
      ctx.shared.set("llm-router.model", parsedModelReference.modelName);
      ctx.shared.set("llm-router.upstream-model", builtAttempt.upstreamModel);

      const startedAt = Date.now();
      ctx.upstreamStartedAt = startedAt;

      try {
        const upstreamResponse = await fetch(toFetchRequest(request), {
          signal: AbortSignal.timeout(config.requestTimeoutMs),
        });
        const completedAt = Date.now();
        const latencyMs = completedAt - startedAt;
        ctx.upstreamCompletedAt = completedAt;

        if (config.retryOnStatus.includes(upstreamResponse.status) && attempt < maxAttempts) {
          await storage.markFailure({
            pluginId: ctx.plugin.id,
            providerName: provider.name,
            now: completedAt,
            failureThreshold: config.circuitBreaker.failureThreshold,
            minimumRequests: config.circuitBreaker.minimumRequests,
            errorRateThreshold: config.circuitBreaker.errorRateThreshold,
          });
          lastFailureReason = `Provider "${provider.name}" returned retryable status ${upstreamResponse.status}`;
          await persistAttemptLog(storage, config, {
            pluginId: ctx.plugin.id,
            requestId: ctx.requestId,
            clientType: clientProfile,
            providerName: provider.name,
            model: builtAttempt.upstreamModel,
            statusCode: upstreamResponse.status,
            latencyMs,
            failureReason: lastFailureReason,
          });
          continue;
        }

        if (config.retryOnStatus.includes(upstreamResponse.status)) {
          await storage.markFailure({
            pluginId: ctx.plugin.id,
            providerName: provider.name,
            now: completedAt,
            failureThreshold: config.circuitBreaker.failureThreshold,
            minimumRequests: config.circuitBreaker.minimumRequests,
            errorRateThreshold: config.circuitBreaker.errorRateThreshold,
          });
        } else {
          await storage.markSuccess({
            pluginId: ctx.plugin.id,
            providerName: provider.name,
            now: completedAt,
            successThreshold: config.circuitBreaker.successThreshold,
          });
        }

        const response = await adapter.transformResponse({
          provider,
          normalizedRequest,
          response: upstreamResponse,
        });

        await persistAttemptLog(storage, config, {
          pluginId: ctx.plugin.id,
          requestId: ctx.requestId,
          clientType: clientProfile,
          providerName: provider.name,
          model: builtAttempt.upstreamModel,
          statusCode: response.status,
          latencyMs,
          failureReason:
            response.status >= 400 && response.status !== upstreamResponse.status
              ? `Adapter response status ${response.status}`
              : null,
        });

        return {
          stop: true,
          response,
        };
      } catch (error) {
        const completedAt = Date.now();
        const latencyMs = completedAt - startedAt;
        ctx.upstreamCompletedAt = completedAt;

        await storage.markFailure({
          pluginId: ctx.plugin.id,
          providerName: provider.name,
          now: completedAt,
          failureThreshold: config.circuitBreaker.failureThreshold,
          minimumRequests: config.circuitBreaker.minimumRequests,
          errorRateThreshold: config.circuitBreaker.errorRateThreshold,
        });

        lastFailureReason = getErrorMessage(error);
        await persistAttemptLog(storage, config, {
          pluginId: ctx.plugin.id,
          requestId: ctx.requestId,
          clientType: clientProfile,
          providerName: provider.name,
          model: builtAttempt.upstreamModel,
          statusCode: null,
          latencyMs,
          failureReason: lastFailureReason,
        });
      }
    }

    return unavailable(lastFailureReason, 502);
  },
};

export function createLlmRouterStorage(rawDb: DatabaseClient): LlmRouterStorage {
  const db = createDatabase(rawDb);

  return {
    async getProviderByName(providerName) {
      const row = await db
        .select()
        .from(llmProviders)
        .where(eq(llmProviders.name, providerName))
        .get();
      if (!row) {
        return null;
      }

      return {
        id: row.id,
        ...LlmProviderResourceSchema.parse({
          name: row.name,
          displayName: row.displayName ?? row.name,
          vendor: row.vendor ?? "custom",
          enabled: row.enabled ?? true,
          protocol: row.protocol,
          baseUrl: row.baseUrl,
          clients: row.clients ?? undefined,
          headers: row.headers ?? {},
          auth: row.auth ?? { type: "none" },
          adapterConfig: row.adapterConfig ?? {},
        }),
      };
    },
    async getModelByProviderAndName(providerId, modelName) {
      const row = await db
        .select()
        .from(llmModels)
        .where(and(eq(llmModels.providerId, providerId), eq(llmModels.name, modelName)))
        .get();
      if (!row) {
        return null;
      }

      return {
        id: row.id,
        ...LlmModelResourceSchema.parse({
          providerId: row.providerId,
          name: row.name,
          upstreamModel: row.upstreamModel,
          enabled: row.enabled ?? true,
          metadata: row.metadata ?? {},
        }),
      };
    },
    async getCircuitState(input) {
      return db.transaction(async (tx) => {
        const existing = await tx
          .select()
          .from(pluginLlmRouterCircuits)
          .where(
            and(
              eq(pluginLlmRouterCircuits.pluginId, input.pluginId),
              eq(pluginLlmRouterCircuits.providerName, input.providerName),
            ),
          )
          .get();

        if (!existing) {
          return {
            state: "closed",
            shouldSkip: false,
          };
        }

        if (
          existing.state === "open" &&
          existing.openedAt !== null &&
          input.now - existing.openedAt >= input.openTimeoutMs
        ) {
          const timestamp = new Date(input.now).toISOString();
          await tx
            .insert(pluginLlmRouterCircuits)
            .values({
              pluginId: input.pluginId,
              providerName: input.providerName,
              state: "half-open",
              consecutiveFailures: existing.consecutiveFailures,
              consecutiveSuccesses: 0,
              requestCount: existing.requestCount,
              failureCount: existing.failureCount,
              openedAt: existing.openedAt,
              createdAt: existing.createdAt,
              updatedAt: timestamp,
            })
            .onConflictDoUpdate({
              target: [pluginLlmRouterCircuits.pluginId, pluginLlmRouterCircuits.providerName],
              set: {
                state: "half-open",
                consecutiveFailures: existing.consecutiveFailures,
                consecutiveSuccesses: 0,
                requestCount: existing.requestCount,
                failureCount: existing.failureCount,
                openedAt: existing.openedAt,
                updatedAt: timestamp,
              },
            });

          return {
            state: "half-open",
            shouldSkip: false,
          };
        }

        return {
          state: existing.state,
          shouldSkip: existing.state === "open",
        };
      });
    },
    async markSuccess(input) {
      await db.transaction(async (tx) => {
        const existing = await tx
          .select()
          .from(pluginLlmRouterCircuits)
          .where(
            and(
              eq(pluginLlmRouterCircuits.pluginId, input.pluginId),
              eq(pluginLlmRouterCircuits.providerName, input.providerName),
            ),
          )
          .get();

        const requestCount = (existing?.requestCount ?? 0) + 1;
        const failureCount = existing?.failureCount ?? 0;
        const wasHalfOpen = existing?.state === "half-open";
        const consecutiveSuccesses = wasHalfOpen ? (existing?.consecutiveSuccesses ?? 0) + 1 : 0;
        const nextState: CircuitState =
          wasHalfOpen && consecutiveSuccesses < input.successThreshold ? "half-open" : "closed";
        const timestamp = new Date(input.now).toISOString();

        await tx
          .insert(pluginLlmRouterCircuits)
          .values({
            pluginId: input.pluginId,
            providerName: input.providerName,
            state: nextState,
            consecutiveFailures: 0,
            consecutiveSuccesses: nextState === "half-open" ? consecutiveSuccesses : 0,
            requestCount,
            failureCount,
            openedAt: null,
            createdAt: existing?.createdAt ?? timestamp,
            updatedAt: timestamp,
          })
          .onConflictDoUpdate({
            target: [pluginLlmRouterCircuits.pluginId, pluginLlmRouterCircuits.providerName],
            set: {
              state: nextState,
              consecutiveFailures: 0,
              consecutiveSuccesses: nextState === "half-open" ? consecutiveSuccesses : 0,
              requestCount,
              failureCount,
              openedAt: null,
              updatedAt: timestamp,
            },
          });
      });
    },
    async markFailure(input) {
      await db.transaction(async (tx) => {
        const existing = await tx
          .select()
          .from(pluginLlmRouterCircuits)
          .where(
            and(
              eq(pluginLlmRouterCircuits.pluginId, input.pluginId),
              eq(pluginLlmRouterCircuits.providerName, input.providerName),
            ),
          )
          .get();

        const requestCount = (existing?.requestCount ?? 0) + 1;
        const failureCount = (existing?.failureCount ?? 0) + 1;
        const consecutiveFailures = (existing?.consecutiveFailures ?? 0) + 1;
        const errorRate = requestCount > 0 ? failureCount / requestCount : 0;
        const shouldOpen =
          existing?.state === "half-open" ||
          consecutiveFailures >= input.failureThreshold ||
          (requestCount >= input.minimumRequests && errorRate >= input.errorRateThreshold);
        const nextState: CircuitState = shouldOpen ? "open" : "closed";
        const timestamp = new Date(input.now).toISOString();

        await tx
          .insert(pluginLlmRouterCircuits)
          .values({
            pluginId: input.pluginId,
            providerName: input.providerName,
            state: nextState,
            consecutiveFailures,
            consecutiveSuccesses: 0,
            requestCount,
            failureCount,
            openedAt: nextState === "open" ? input.now : null,
            createdAt: existing?.createdAt ?? timestamp,
            updatedAt: timestamp,
          })
          .onConflictDoUpdate({
            target: [pluginLlmRouterCircuits.pluginId, pluginLlmRouterCircuits.providerName],
            set: {
              state: nextState,
              consecutiveFailures,
              consecutiveSuccesses: 0,
              requestCount,
              failureCount,
              openedAt: nextState === "open" ? input.now : null,
              updatedAt: timestamp,
            },
          });
      });
    },
    async logAttempt(input) {
      await db.insert(pluginLlmRouterRequestLogs).values({
        pluginId: input.pluginId,
        requestId: input.requestId,
        clientType: input.clientType,
        providerName: input.providerName,
        model: input.model,
        statusCode: input.statusCode,
        latencyMs: input.latencyMs,
        failureReason: input.failureReason,
        createdAt: new Date().toISOString(),
      });
    },
  };
}

function normalizeConfig(config: Record<string, unknown>): LlmRouterConfig {
  return LlmRouterConfigSchema.parse(config);
}

function resolveClientProfile(
  ctx: PluginContext,
  config: LlmRouterConfig,
  normalizedRequest?: NormalizedLlmRequest | null,
): LlmClientProfile {
  if (config.clientProfile !== "auto") {
    return config.clientProfile;
  }

  for (const rule of config.clientRules) {
    if (matchesClientRule(ctx.clientRequest, rule)) {
      return rule.client;
    }
  }

  if (normalizedRequest) {
    return normalizedRequest.clientProfile;
  }

  const pathname = ctx.clientRequest.url.pathname;
  if (pathname.startsWith("/v1/responses")) {
    return "codex";
  }
  if (pathname.startsWith("/v1/messages")) {
    return "claude";
  }
  if (pathname.startsWith("/v1/chat/completions")) {
    return "openai-compatible";
  }
  if (pathname.startsWith("/v1beta") || pathname.includes("/models/")) {
    return "gemini";
  }

  return "unknown";
}

function resolveNormalizedRequest(
  request: HttpRequestState,
  clientProfile: LlmClientProfile,
  normalizedRequest?: NormalizedLlmRequest | null,
): NormalizedLlmRequest {
  const freshNormalizedRequest = normalizeLlmRequest(request, clientProfile);
  if (!normalizedRequest) {
    return freshNormalizedRequest;
  }

  return {
    ...freshNormalizedRequest,
    protocol: normalizedRequest.protocol,
    clientProfile,
  };
}

function matchesClientRule(
  request: PluginContext["clientRequest"],
  rule: LlmRouterConfig["clientRules"][number],
): boolean {
  const { match } = rule;
  if (match.pathPrefix && !request.url.pathname.startsWith(match.pathPrefix)) {
    return false;
  }

  if (match.method && request.method.toUpperCase() !== match.method.toUpperCase()) {
    return false;
  }

  if (match.header) {
    const headerValue = request.headers.get(match.header.name);
    if (!headerValue) {
      return false;
    }
    if (match.header.value && headerValue !== match.header.value) {
      return false;
    }
  }

  return true;
}

function buildProviderUrl(baseUrl: string, pathname: string, search: string): URL {
  const upstreamUrl = new URL(baseUrl);
  const normalizedBasePath = normalizePath(upstreamUrl.pathname);
  const normalizedRequestPath = normalizePath(pathname);

  if (normalizedBasePath === "/") {
    upstreamUrl.pathname = normalizedRequestPath;
  } else if (
    normalizedRequestPath === normalizedBasePath ||
    normalizedRequestPath.startsWith(`${normalizedBasePath}/`)
  ) {
    upstreamUrl.pathname = normalizedRequestPath;
  } else if (normalizedRequestPath === "/v1" || normalizedRequestPath.startsWith("/v1/")) {
    upstreamUrl.pathname = normalizedRequestPath.replace(/^\/v1(?=\/|$)/, normalizedBasePath);
  } else {
    upstreamUrl.pathname = joinPaths(normalizedBasePath, normalizedRequestPath);
  }

  upstreamUrl.search = search;
  upstreamUrl.hash = "";
  return upstreamUrl;
}

function resolveProviderAuth(
  provider: StoredLlmProvider,
): { name: string; value: string } | { error: string } | null {
  const auth = provider.auth;
  switch (auth.type) {
    case "none":
      return null;
    case "bearer": {
      const token = auth.token ?? (auth.tokenEnv ? process.env[auth.tokenEnv] : undefined);
      if (!token) {
        return {
          error: `Provider "${provider.name}" is missing bearer token value`,
        };
      }

      return {
        name: auth.headerName ?? "authorization",
        value: `Bearer ${token}`,
      };
    }
    case "api-key": {
      const key = auth.key ?? (auth.keyEnv ? process.env[auth.keyEnv] : undefined);
      if (!key) {
        return {
          error: `Provider "${provider.name}" is missing API key value`,
        };
      }

      return {
        name: auth.headerName ?? "x-api-key",
        value: key,
      };
    }
    default:
      return null;
  }
}

function scrubAuthHeaders(headers: Headers): void {
  headers.delete("authorization");
  headers.delete("x-api-key");
  headers.delete("api-key");
}

function normalizePath(pathname: string): string {
  if (!pathname || pathname === "/") {
    return "/";
  }

  return pathname.startsWith("/") ? pathname.replace(/\/+$/, "") || "/" : `/${pathname}`;
}

function joinPaths(left: string, right: string): string {
  if (left === "/") {
    return normalizePath(right);
  }

  const normalizedRight = normalizePath(right);
  if (normalizedRight === "/") {
    return left;
  }

  return `${left.replace(/\/+$/, "")}/${normalizedRight.replace(/^\/+/, "")}`;
}

function cloneRequestState(state: HttpRequestState): HttpRequestState {
  return {
    method: state.method,
    url: new URL(state.url.toString()),
    headers: new Headers(state.headers),
    body: state.body ? cloneArrayBuffer(state.body) : null,
  };
}

function getStorage(ctx: PluginContext): LlmRouterStorage {
  if (!ctx.pluginStorage) {
    throw new Error("llm-router storage is not initialized");
  }

  return ctx.pluginStorage as LlmRouterStorage;
}

function persistAttemptLog(
  storage: LlmRouterStorage,
  config: LlmRouterConfig,
  entry: AttemptLogEntry,
): Promise<void> {
  if (!config.logging.enabled) {
    return Promise.resolve();
  }

  return storage.logAttempt(entry);
}

function badRequest(message: string): PluginHandlerResult {
  return {
    stop: true,
    response: new Response(
      JSON.stringify({
        error: "Bad Request",
        message,
      }),
      {
        status: 400,
        headers: {
          "content-type": "application/json",
        },
      },
    ),
  };
}

function unavailable(message: string, status = 503): PluginHandlerResult {
  return {
    stop: true,
    response: new Response(
      JSON.stringify({
        error: "Provider Unavailable",
        message,
      }),
      {
        status,
        headers: {
          "content-type": "application/json",
        },
      },
    ),
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      return "Request timed out";
    }
    return error.message;
  }

  return String(error);
}
