import type Database from "better-sqlite3";
import { z } from "zod";
import type { Consumer } from "../../entities/types.js";
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
  findByApiKey: (apiKey: string) => AuthenticatedCredential | null;
}

export const KeyAuthPlugin: PluginDefinition = {
  name: "key-auth",
  version: "3.0.0",
  priority: 1250,
  phases: ["access"],
  configSchema: keyAuthConfigSchema,
  createStorage: (ctx) => createKeyAuthStorage(ctx.rawDb),

  onAccess: async (ctx: PluginContext): Promise<PluginHandlerResult | void> => {
    const config = normalizeConfig(ctx.config);
    const presentedCredential = findCredential(ctx, config.keyNames);

    if (!presentedCredential) {
      return unauthorized("No API key found in request");
    }

    const storage = getKeyAuthStorage(ctx);
    const authenticated = storage.findByApiKey(presentedCredential.value);
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

export function createKeyAuthStorage(rawDb: Database.Database): KeyAuthStorage {
  const findByApiKeyStmt = rawDb.prepare<
    [string],
    {
      credential_id: string;
      credential_key: string;
      consumer_id: string;
      consumer_username: string | null;
      consumer_custom_id: string | null;
      consumer_tags: string | null;
      consumer_created_at: string | null;
      consumer_updated_at: string | null;
    }
  >(
    `SELECT
       credentials.id AS credential_id,
       json_extract(credentials.credential, '$.key') AS credential_key,
       consumers.id AS consumer_id,
       consumers.username AS consumer_username,
       consumers.custom_id AS consumer_custom_id,
       consumers.tags AS consumer_tags,
       consumers.created_at AS consumer_created_at,
       consumers.updated_at AS consumer_updated_at
     FROM credentials
     INNER JOIN consumers ON consumers.id = credentials.consumer_id
     WHERE credentials.credential_type = 'key-auth'
       AND json_extract(credentials.credential, '$.key') = ?
     LIMIT 1`,
  );

  return {
    findByApiKey(apiKey: string): AuthenticatedCredential | null {
      const row = findByApiKeyStmt.get(apiKey);
      if (!row) {
        return null;
      }

      return {
        credentialId: row.credential_id,
        key: row.credential_key,
        consumer: {
          id: row.consumer_id,
          username: row.consumer_username,
          customId: row.consumer_custom_id,
          tags: parseTags(row.consumer_tags),
          createdAt: row.consumer_created_at,
          updatedAt: row.consumer_updated_at,
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

function parseTags(input: string | null): string[] {
  if (!input) {
    return [];
  }

  try {
    const parsed = JSON.parse(input) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((value): value is string => typeof value === "string");
  } catch {
    return [];
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
