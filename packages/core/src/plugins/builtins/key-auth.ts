import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Consumer } from "../../entities/types.js";
import { createDatabase } from "../../storage/database.js";
import { consumers, credentials } from "../../storage/schema.js";
import type { DatabaseClient } from "../../storage/types.js";
import type { PluginContext, PluginDefinition, PluginHandlerResult } from "../types.js";

const keyAuthConfigSchema = z
  .object({
    key_names: z.array(z.string().min(1)).optional(),
    keyNames: z.array(z.string().min(1)).optional(),
    hide_credentials: z.boolean().optional(),
    hideCredentials: z.boolean().optional(),
  })
  .transform((config) => ({
    keyNames: config.key_names ?? config.keyNames ?? ["apikey", "api_key", "x-api-key"],
    hideCredentials: config.hide_credentials ?? config.hideCredentials ?? false,
  }));

type KeyAuthConfig = z.output<typeof keyAuthConfigSchema>;

interface PresentedCredential {
  name: string;
  value: string;
  source: "header" | "query";
}

interface AuthenticatedCredential {
  credentialId: string;
  key: string;
  consumer: Consumer;
}

interface KeyAuthStorage {
  findByApiKey: (apiKey: string) => Promise<AuthenticatedCredential | null>;
}

export const KeyAuthPlugin: PluginDefinition = {
  name: "key-auth",
  version: "3.0.0",
  displayName: "Key Auth",
  description: "Authenticate requests by API key and resolve the matching consumer.",
  priority: 1250,
  phases: ["access"],
  configSchema: keyAuthConfigSchema,
  configDescriptor: {
    fields: [
      {
        key: "keyNames",
        kind: "string-list",
        label: "Accepted key names",
        description: "Headers or query parameters checked for the API key.",
        itemLabel: "Key name",
      },
      {
        key: "hideCredentials",
        kind: "boolean",
        label: "Strip credential before proxying",
      },
    ],
  },
  createStorage: (ctx) => createKeyAuthStorage(ctx.rawDb),

  onAccess: async (ctx: PluginContext): Promise<PluginHandlerResult | void> => {
    const config = normalizeConfig(ctx.config);
    const presentedCredential = findCredential(ctx, config.keyNames);

    if (!presentedCredential) {
      return unauthorized("No API key found in request");
    }

    const storage = getKeyAuthStorage(ctx);
    const authenticated = await storage.findByApiKey(presentedCredential.value);
    if (!authenticated) {
      return unauthorized("Invalid API key");
    }

    ctx.consumer = authenticated.consumer;
    ctx.shared.set("authenticated", true);
    ctx.shared.set("api-key", authenticated.key);
    ctx.shared.set("credential-id", authenticated.credentialId);
    ctx.shared.set("auth-key-name", presentedCredential.name);
    ctx.shared.set("consumer-id", authenticated.consumer.id);

    writeAuthenticatedConsumerHeaders(ctx, authenticated);

    if (config.hideCredentials) {
      stripCredentialFromUpstreamRequest(ctx, presentedCredential);
    }
  },
};

export function createKeyAuthStorage(rawDb: DatabaseClient): KeyAuthStorage {
  const db = createDatabase(rawDb);

  return {
    async findByApiKey(apiKey: string): Promise<AuthenticatedCredential | null> {
      const row = await db
        .select({
          credentialId: credentials.id,
          credential: credentials.credential,
          consumerId: consumers.id,
          consumerUsername: consumers.username,
          consumerCustomId: consumers.customId,
          consumerTags: consumers.tags,
          consumerCreatedAt: consumers.createdAt,
          consumerUpdatedAt: consumers.updatedAt,
        })
        .from(credentials)
        .innerJoin(consumers, eq(consumers.id, credentials.consumerId))
        .where(
          and(
            eq(credentials.credentialType, "key-auth"),
            sql`json_extract(${credentials.credential}, '$.key') = ${apiKey}`,
          ),
        )
        .get();

      if (!row) {
        return null;
      }

      const key = row.credential?.key;
      if (typeof key !== "string") {
        return null;
      }

      return {
        credentialId: row.credentialId,
        key,
        consumer: {
          id: row.consumerId,
          username: row.consumerUsername,
          customId: row.consumerCustomId,
          tags: row.consumerTags ?? [],
          createdAt: row.consumerCreatedAt,
          updatedAt: row.consumerUpdatedAt,
        },
      };
    },
  };
}

function normalizeConfig(config: Record<string, unknown>): KeyAuthConfig {
  return keyAuthConfigSchema.parse(config);
}

function findCredential(ctx: PluginContext, keyNames: string[]): PresentedCredential | null {
  for (const keyName of keyNames) {
    const headerValue = ctx.clientRequest.headers.get(keyName);
    if (headerValue) {
      return { name: keyName, value: headerValue, source: "header" };
    }

    const queryValue = ctx.clientRequest.url.searchParams.get(keyName);
    if (queryValue) {
      return { name: keyName, value: queryValue, source: "query" };
    }
  }

  return null;
}

function stripCredentialFromUpstreamRequest(
  ctx: PluginContext,
  credential: PresentedCredential,
): void {
  if (credential.source === "header") {
    ctx.request.headers.delete(credential.name);
    return;
  }

  ctx.request.url.searchParams.delete(credential.name);
}

function writeAuthenticatedConsumerHeaders(
  ctx: PluginContext,
  authenticated: AuthenticatedCredential,
): void {
  ctx.request.headers.set("x-consumer-id", authenticated.consumer.id);
  ctx.request.headers.set("x-credential-identifier", authenticated.key);

  if (authenticated.consumer.username) {
    ctx.request.headers.set("x-consumer-username", authenticated.consumer.username);
  } else {
    ctx.request.headers.delete("x-consumer-username");
  }

  if (authenticated.consumer.customId) {
    ctx.request.headers.set("x-consumer-custom-id", authenticated.consumer.customId);
  } else {
    ctx.request.headers.delete("x-consumer-custom-id");
  }
}

function getKeyAuthStorage(ctx: PluginContext): KeyAuthStorage {
  if (!ctx.pluginStorage) {
    throw new Error("Key auth storage is not initialized");
  }

  return ctx.pluginStorage as KeyAuthStorage;
}

function unauthorized(message: string): PluginHandlerResult {
  return {
    stop: true,
    response: new Response(
      JSON.stringify({
        error: "Unauthorized",
        message,
      }),
      {
        status: 401,
        headers: {
          "content-type": "application/json",
          "www-authenticate": "ApiKey",
        },
      },
    ),
  };
}
