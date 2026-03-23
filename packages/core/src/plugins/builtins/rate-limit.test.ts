import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { DatabaseService } from "../../storage/database.js";
import { runMigrations } from "../../storage/migrations.js";
import { createPluginStorageContext } from "../storage-context.js";
import { createPluginTestContext } from "../test-context.js";
import { RateLimitPlugin } from "./rate-limit.js";

describe("RateLimitPlugin", () => {
  let tempDir: string;
  let dbPath: string;
  let db: DatabaseService;
  let pluginStorage: unknown;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "rate-limit-plugin-test-"));
    dbPath = join(tempDir, "test.db");
    runMigrations(dbPath);
    db = new DatabaseService(dbPath);
    pluginStorage = createStorage(db);
  });

  afterEach(() => {
    db.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("allows requests under the configured limit", async () => {
    const ctx = createRateLimitContext({
      pluginStorage,
      clientRequest: {
        method: "GET",
        url: new URL("http://gateway.test/source"),
        headers: new Headers({ "x-forwarded-for": "203.0.113.10" }),
        body: null,
      },
      config: {
        limit: 10,
        window: 60,
      },
    });

    const result = await RateLimitPlugin.onAccess?.(ctx);

    expect(result).toBeUndefined();
  });

  test("persists counters across database connections", async () => {
    const firstCtx = createRateLimitContext({
      pluginStorage,
      clientRequest: {
        method: "GET",
        url: new URL("http://gateway.test/source"),
        headers: new Headers({ "x-forwarded-for": "203.0.113.11" }),
        body: null,
      },
      config: {
        limit: 1,
        window: 60,
      },
    });

    await RateLimitPlugin.onAccess?.(firstCtx);

    db.close();
    db = new DatabaseService(dbPath);
    pluginStorage = createStorage(db);

    const secondCtx = createRateLimitContext({
      pluginStorage,
      clientRequest: {
        method: "GET",
        url: new URL("http://gateway.test/source"),
        headers: new Headers({ "x-forwarded-for": "203.0.113.11" }),
        body: null,
      },
      config: {
        limit: 1,
        window: 60,
      },
    });

    const result = await RateLimitPlugin.onAccess?.(secondCtx);

    expect(result?.stop).toBe(true);
    expect(result?.response?.status).toBe(429);
    expect(result?.response?.headers.get("retry-after")).toBeTruthy();
  });

  test("adds rate-limit headers during response phase", async () => {
    const ctx = createRateLimitContext({
      phase: "response",
      pluginStorage,
      clientRequest: {
        method: "GET",
        url: new URL("http://gateway.test/source"),
        headers: new Headers({ "x-forwarded-for": "203.0.113.12" }),
        body: null,
      },
      response: {
        status: 200,
        statusText: "OK",
        headers: new Headers(),
        body: null,
        source: "upstream",
      },
      config: {
        limit: 10,
        window: 60,
        headers: true,
      },
    });

    await RateLimitPlugin.onAccess?.(ctx);
    await RateLimitPlugin.onResponse?.(ctx);

    expect(ctx.response?.headers.get("x-ratelimit-limit")).toBe("10");
    expect(ctx.response?.headers.get("x-ratelimit-remaining")).toBeTruthy();
  });
});

function createStorage(db: DatabaseService): unknown {
  return RateLimitPlugin.createStorage?.(
    createPluginStorageContext(db.getRawDatabase(), RateLimitPlugin),
  );
}

function createRateLimitContext(overrides?: Parameters<typeof createPluginTestContext>[0]) {
  return createPluginTestContext({
    plugin: {
      id: "rate-limit-plugin-binding",
      name: "rate-limit",
      config: {},
      enabled: true,
      priority: RateLimitPlugin.priority,
    },
    ...overrides,
  });
}
