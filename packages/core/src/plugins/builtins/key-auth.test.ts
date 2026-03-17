import { test, expect, describe } from "vite-plus/test";
import { KeyAuthPlugin } from "./key-auth.js";
import type { PluginContext } from "../types.js";

describe("KeyAuthPlugin", () => {
  const createMockContext = (overrides?: Partial<PluginContext>): PluginContext => ({
    request: new Request("http://example.com"),
    url: new URL("http://example.com"),
    method: "GET",
    headers: new Headers(),
    plugin: {
      id: "1",
      name: "key-auth",
      config: {},
      enabled: true,
      tags: [],
      consumerId: null,
      routeId: null,
      serviceId: null,
      priority: 70,
    },
    config: {},
    state: new Map(),
    waitUntil: () => {},
    ...overrides,
  });

  test("has correct metadata", () => {
    expect(KeyAuthPlugin.name).toBe("key-auth");
    expect(KeyAuthPlugin.version).toBe("1.0.0");
    expect(KeyAuthPlugin.priority).toBe(70);
    expect(KeyAuthPlugin.phases).toEqual(["request"]);
  });

  test("returns 401 when no API key provided", async () => {
    const ctx = createMockContext();

    const result = await KeyAuthPlugin.onRequest?.(ctx);

    expect(result?.stop).toBe(true);
    expect(result?.response?.status).toBe(401);
    expect(result?.response?.headers.get("Content-Type")).toBe("application/json");
    expect(result?.response?.headers.get("WWW-Authenticate")).toBe("ApiKey");
  });

  test("returns 401 with error message", async () => {
    const ctx = createMockContext();

    const result = await KeyAuthPlugin.onRequest?.(ctx);

    const body = await result?.response?.json();
    expect(body?.error).toBe("Unauthorized");
    expect(body?.message).toContain("No API key found");
  });

  test("accepts API key from default header X-API-Key", async () => {
    const ctx = createMockContext({
      headers: new Headers({ "x-api-key": "valid-key-123" }),
    });

    const result = await KeyAuthPlugin.onRequest?.(ctx);

    expect(result).toBeUndefined();
    expect(ctx.state.get("authenticated")).toBe(true);
    expect(ctx.state.get("api-key")).toBe("valid-key-123");
  });

  test("accepts API key from custom header name", async () => {
    const ctx = createMockContext({
      config: { headerName: "Custom-Auth" },
      headers: new Headers({ "custom-auth": "my-api-key" }),
    });

    const result = await KeyAuthPlugin.onRequest?.(ctx);

    expect(result).toBeUndefined();
    expect(ctx.state.get("api-key")).toBe("my-api-key");
  });

  test("accepts API key from query parameter", async () => {
    const ctx = createMockContext({
      url: new URL("http://example.com/path?api_key=query-key-456"),
    });

    const result = await KeyAuthPlugin.onRequest?.(ctx);

    expect(result).toBeUndefined();
    expect(ctx.state.get("api-key")).toBe("query-key-456");
  });

  test("prefers header over query parameter", async () => {
    const ctx = createMockContext({
      url: new URL("http://example.com/path?api_key=query-key"),
      headers: new Headers({ "x-api-key": "header-key" }),
    });

    const result = await KeyAuthPlugin.onRequest?.(ctx);

    expect(result).toBeUndefined();
    expect(ctx.state.get("api-key")).toBe("header-key");
  });

  test("uses custom query param name", async () => {
    const ctx = createMockContext({
      config: { queryParamName: "token" },
      url: new URL("http://example.com/path?token=custom-token"),
    });

    const result = await KeyAuthPlugin.onRequest?.(ctx);

    expect(result).toBeUndefined();
    expect(ctx.state.get("api-key")).toBe("custom-token");
  });

  test("uses custom query param name", async () => {
    const ctx = createMockContext({
      config: { queryParamName: "token" },
      url: new URL("http://example.com/path?token=custom-token"),
    });

    const result = await KeyAuthPlugin.onRequest?.(ctx);

    expect(result).toBeUndefined();
    expect(ctx.state.get("api-key")).toBe("custom-token");
  });

  test("sets hide-api-key state when configured", async () => {
    const ctx = createMockContext({
      config: { hideCredentials: true },
      headers: new Headers({ "x-api-key": "secret-key" }),
    });

    const result = await KeyAuthPlugin.onRequest?.(ctx);

    expect(result).toBeUndefined();
    expect(ctx.state.get("hide-api-key")).toBe(true);
  });

  test("does not set hide-api-key when not configured", async () => {
    const ctx = createMockContext({
      headers: new Headers({ "x-api-key": "visible-key" }),
    });

    const result = await KeyAuthPlugin.onRequest?.(ctx);

    expect(result).toBeUndefined();
    expect(ctx.state.get("hide-api-key")).toBeUndefined();
  });

  test("validates API key against credentials cache", async () => {
    const credentialsCache = new Map<string, unknown>();
    credentialsCache.set("cached-key", {});

    const ctx = createMockContext({
      headers: new Headers({ "x-api-key": "cached-key" }),
    });
    ctx.state.set("credentials-cache", credentialsCache);

    const result = await KeyAuthPlugin.onRequest?.(ctx);

    expect(result).toBeUndefined();
    expect(ctx.state.get("authenticated")).toBe(true);
  });

  test("rejects API key not in credentials cache", async () => {
    const credentialsCache = new Map<string, unknown>();
    credentialsCache.set("other-key", {});

    const ctx = createMockContext({
      headers: new Headers({ "x-api-key": "unknown-key" }),
    });
    ctx.state.set("credentials-cache", credentialsCache);

    const result = await KeyAuthPlugin.onRequest?.(ctx);

    expect(result?.stop).toBe(true);
    expect(result?.response?.status).toBe(401);
  });

  test("returns 401 for invalid API key", async () => {
    const ctx = createMockContext({
      headers: new Headers({ "x-api-key": "invalid-key" }),
    });

    // By default, all keys are accepted in development mode
    // But if we set up a credentials cache, it will validate
    const credentialsCache = new Map<string, unknown>();
    ctx.state.set("credentials-cache", credentialsCache);

    const result = await KeyAuthPlugin.onRequest?.(ctx);

    expect(result?.stop).toBe(true);
    expect(result?.response?.status).toBe(401);

    const body = await result?.response?.json();
    expect(body?.error).toBe("Unauthorized");
    expect(body?.message).toBe("Invalid API key");
  });

  test("handles case-insensitive header names", async () => {
    const ctx = createMockContext({
      headers: new Headers({ "X-API-KEY": "uppercase-key" }),
    });

    const result = await KeyAuthPlugin.onRequest?.(ctx);

    expect(result).toBeUndefined();
    expect(ctx.state.get("api-key")).toBe("uppercase-key");
  });
});
