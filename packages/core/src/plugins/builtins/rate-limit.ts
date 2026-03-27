import { and, eq, lte } from "drizzle-orm";
import { z } from "zod";
import { createDatabase } from "../../storage/database.js";
import { pluginRateLimitCounters } from "../../storage/schema.js";
import type { DatabaseClient } from "../../storage/types.js";
import type { PluginContext, PluginDefinition, PluginHandlerResult } from "../types.js";

const rateLimitConfigSchema = z.object({
  limit: z.number().int().positive().default(100),
  window: z.number().int().positive().default(60),
  key: z.enum(["ip", "header", "consumer"]).default("ip"),
  headerName: z.string().min(1).optional(),
  headers: z.boolean().default(true),
});

type RateLimitConfig = z.infer<typeof rateLimitConfigSchema>;

interface RateLimitCounter {
  count: number;
  resetAt: number;
}

interface RateLimitStorage {
  increment(input: {
    pluginId: string;
    identifier: string;
    now: number;
    windowMs: number;
  }): Promise<RateLimitCounter>;
}

export const RateLimitPlugin: PluginDefinition = {
  name: "rate-limit",
  version: "3.0.0",
  priority: 910,
  phases: ["access", "response"],
  configSchema: rateLimitConfigSchema,
  createStorage: (ctx) => createRateLimitStorage(ctx.rawDb),

  onAccess: async (ctx: PluginContext): Promise<PluginHandlerResult | void> => {
    const config = normalizeConfig(ctx.config);
    const storage = getRateLimitStorage(ctx);
    const now = Date.now();
    const windowMs = config.window * 1000;
    const identifier = getClientId(ctx, config);
    const counter = await storage.increment({
      pluginId: ctx.plugin.id,
      identifier,
      now,
      windowMs,
    });

    const headers = buildRateLimitHeaders(config.limit, counter.count, counter.resetAt);
    ctx.shared.set("rate-limit-headers", headers);

    if (counter.count <= config.limit) {
      return;
    }

    const retryAfter = Math.max(0, Math.ceil((counter.resetAt - now) / 1000));

    return {
      stop: true,
      response: new Response(
        JSON.stringify({
          error: "Too Many Requests",
          message: `Rate limit exceeded. Limit: ${config.limit} requests per ${config.window} seconds.`,
          retry_after: retryAfter,
        }),
        {
          status: 429,
          headers: {
            ...Object.fromEntries(headers.entries()),
            "content-type": "application/json",
            "retry-after": String(retryAfter),
          },
        },
      ),
    };
  },

  onResponse: (ctx: PluginContext): void => {
    if (!ctx.response) {
      return;
    }

    const config = normalizeConfig(ctx.config);
    if (!config.headers) {
      return;
    }

    const headers = ctx.shared.get("rate-limit-headers") as Headers | undefined;
    if (!headers) {
      return;
    }

    headers.forEach((value, key) => {
      ctx.response?.headers.set(key, value);
    });
  },
};

export function createRateLimitStorage(rawDb: DatabaseClient): RateLimitStorage {
  const db = createDatabase(rawDb);

  return {
    async increment(input): Promise<RateLimitCounter> {
      return db.transaction(async (tx) => {
        await tx
          .delete(pluginRateLimitCounters)
          .where(lte(pluginRateLimitCounters.expiresAt, input.now));

        const existing = await tx
          .select()
          .from(pluginRateLimitCounters)
          .where(
            and(
              eq(pluginRateLimitCounters.pluginId, input.pluginId),
              eq(pluginRateLimitCounters.identifier, input.identifier),
            ),
          )
          .get();

        if (!existing) {
          const resetAt = input.now + input.windowMs;
          await tx.insert(pluginRateLimitCounters).values({
            pluginId: input.pluginId,
            identifier: input.identifier,
            count: 1,
            windowStartedAt: input.now,
            expiresAt: resetAt,
          });
          return {
            count: 1,
            resetAt,
          };
        }

        const nextCount = existing.count + 1;
        await tx
          .update(pluginRateLimitCounters)
          .set({
            count: nextCount,
          })
          .where(
            and(
              eq(pluginRateLimitCounters.pluginId, input.pluginId),
              eq(pluginRateLimitCounters.identifier, input.identifier),
            ),
          );

        return {
          count: nextCount,
          resetAt: existing.expiresAt,
        };
      });
    },
  };
}

function normalizeConfig(config: Record<string, unknown>): RateLimitConfig {
  return rateLimitConfigSchema.parse(config);
}

function buildRateLimitHeaders(limit: number, count: number, resetAt: number): Headers {
  return new Headers({
    "x-ratelimit-limit": String(limit),
    "x-ratelimit-remaining": String(Math.max(0, limit - count)),
    "x-ratelimit-reset": String(Math.ceil(resetAt / 1000)),
  });
}

function getClientId(ctx: PluginContext, config: RateLimitConfig): string {
  switch (config.key) {
    case "header":
      return ctx.clientRequest.headers.get(config.headerName ?? "x-api-key") || "unknown";
    case "consumer":
      return ctx.consumer?.id || "anonymous";
    case "ip":
    default:
      return ctx.clientRequest.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  }
}

function getRateLimitStorage(ctx: PluginContext): RateLimitStorage {
  if (!ctx.pluginStorage) {
    throw new Error("Rate limit storage is not initialized");
  }

  return ctx.pluginStorage as RateLimitStorage;
}
