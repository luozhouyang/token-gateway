import type Database from "better-sqlite3";
import { z } from "zod";
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
  }): RateLimitCounter;
}

export const RateLimitPlugin: PluginDefinition = {
  name: "rate-limit",
  version: "3.0.0",
  priority: 910,
  phases: ["access", "response"],
  configSchema: rateLimitConfigSchema,
  migrations: [
    {
      id: "0001_init",
      up: `
        CREATE TABLE IF NOT EXISTS plugin_rate_limit_counters (
          plugin_id text NOT NULL,
          identifier text NOT NULL,
          count integer NOT NULL,
          window_started_at integer NOT NULL,
          expires_at integer NOT NULL,
          PRIMARY KEY(plugin_id, identifier)
        );
        CREATE INDEX IF NOT EXISTS idx_plugin_rate_limit_counters_expires_at
          ON plugin_rate_limit_counters (expires_at);
      `,
    },
  ],
  createStorage: (ctx) => createRateLimitStorage(ctx.rawDb),

  onAccess: (ctx: PluginContext): PluginHandlerResult | void => {
    const config = normalizeConfig(ctx.config);
    const storage = getRateLimitStorage(ctx);
    const now = Date.now();
    const windowMs = config.window * 1000;
    const identifier = getClientId(ctx, config);
    const counter = storage.increment({
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

export function createRateLimitStorage(rawDb: Database.Database): RateLimitStorage {
  const selectCounterStmt = rawDb.prepare<
    [string, string],
    {
      count: number;
      window_started_at: number;
      expires_at: number;
    }
  >(
    `SELECT count, window_started_at, expires_at
       FROM plugin_rate_limit_counters
      WHERE plugin_id = ?
        AND identifier = ?`,
  );
  const deleteExpiredStmt = rawDb.prepare<[number]>(
    "DELETE FROM plugin_rate_limit_counters WHERE expires_at <= ?",
  );
  const upsertCounterStmt = rawDb.prepare<[string, string, number, number, number]>(
    `INSERT INTO plugin_rate_limit_counters (
       plugin_id,
       identifier,
       count,
       window_started_at,
       expires_at
     ) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(plugin_id, identifier) DO UPDATE SET
       count = excluded.count,
       window_started_at = excluded.window_started_at,
       expires_at = excluded.expires_at`,
  );
  const updateCountStmt = rawDb.prepare<[number, string, string]>(
    `UPDATE plugin_rate_limit_counters
        SET count = ?
      WHERE plugin_id = ?
        AND identifier = ?`,
  );

  const increment = rawDb.transaction(
    (pluginId: string, identifier: string, now: number, windowMs: number): RateLimitCounter => {
      deleteExpiredStmt.run(now);

      const existing = selectCounterStmt.get(pluginId, identifier);
      if (!existing) {
        const resetAt = now + windowMs;
        upsertCounterStmt.run(pluginId, identifier, 1, now, resetAt);
        return {
          count: 1,
          resetAt,
        };
      }

      const nextCount = existing.count + 1;
      updateCountStmt.run(nextCount, pluginId, identifier);
      return {
        count: nextCount,
        resetAt: existing.expires_at,
      };
    },
  );

  return {
    increment(input) {
      return increment(input.pluginId, input.identifier, input.now, input.windowMs);
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
