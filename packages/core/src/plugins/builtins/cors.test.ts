import { test, expect, describe } from "vite-plus/test";
import { CorsPlugin } from "./cors.js";
import type { PluginContext, PluginResponse } from "../types.js";

describe("CorsPlugin", () => {
  const createMockContext = (overrides?: Partial<PluginContext>): PluginContext => ({
    request: new Request("http://example.com"),
    url: new URL("http://example.com"),
    method: "GET",
    headers: new Headers(),
    plugin: {
      id: "1",
      name: "cors",
      config: {},
      enabled: true,
      tags: [],
      consumerId: null,
      routeId: null,
      serviceId: null,
      priority: 100,
    },
    config: {},
    state: new Map(),
    waitUntil: () => {},
    ...overrides,
  });

  test("has correct metadata", () => {
    expect(CorsPlugin.name).toBe("cors");
    expect(CorsPlugin.version).toBe("1.0.0");
    expect(CorsPlugin.priority).toBe(100);
    expect(CorsPlugin.phases).toEqual(["request", "response"]);
  });

  test("handles OPTIONS preflight request", () => {
    const ctx = createMockContext({
      method: "OPTIONS",
      config: { origin: "*" },
    });

    const result = CorsPlugin.onRequest?.(ctx) as PluginResponse | undefined;

    expect(result).toBeDefined();
    expect(result?.stop).toBe(true);
    expect(result?.response?.status).toBe(204);
    expect(result?.response?.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  test("handles OPTIONS with specific origin", () => {
    const ctx = createMockContext({
      method: "OPTIONS",
      headers: new Headers({ origin: "https://example.com" }),
      config: { origin: "https://example.com" },
    });

    const result = CorsPlugin.onRequest?.(ctx) as PluginResponse | undefined;

    expect(result?.response?.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://example.com",
    );
  });

  test("handles OPTIONS with array of origins", () => {
    const ctx = createMockContext({
      method: "OPTIONS",
      headers: new Headers({ origin: "https://allowed.com" }),
      config: { origin: ["https://allowed.com", "https://another.com"] },
    });

    const result = CorsPlugin.onRequest?.(ctx) as PluginResponse | undefined;

    expect(result?.response?.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://allowed.com",
    );
  });

  test("rejects origin not in array", () => {
    const ctx = createMockContext({
      method: "OPTIONS",
      headers: new Headers({ origin: "https://not-allowed.com" }),
      config: { origin: ["https://allowed.com", "https://another.com"] },
    });

    const result = CorsPlugin.onRequest?.(ctx) as PluginResponse | undefined;

    // When origin is not in the allowed list, no CORS header is set
    expect(result?.response?.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  test("sets CORS methods header", () => {
    const ctx = createMockContext({
      method: "OPTIONS",
      config: { origin: "*", methods: ["GET", "POST", "PUT"] },
    });

    const result = CorsPlugin.onRequest?.(ctx) as PluginResponse | undefined;

    expect(result?.response?.headers.get("Access-Control-Allow-Methods")).toBe("GET, POST, PUT");
  });

  test("sets CORS allowed headers", () => {
    const ctx = createMockContext({
      method: "OPTIONS",
      config: { origin: "*", allowedHeaders: ["Content-Type", "Authorization"] },
    });

    const result = CorsPlugin.onRequest?.(ctx) as PluginResponse | undefined;

    expect(result?.response?.headers.get("Access-Control-Allow-Headers")).toBe(
      "Content-Type, Authorization",
    );
  });

  test("sets CORS exposed headers", () => {
    const ctx = createMockContext({
      method: "OPTIONS",
      config: { origin: "*", exposedHeaders: ["X-Custom-Header"] },
    });

    const result = CorsPlugin.onRequest?.(ctx) as PluginResponse | undefined;

    expect(result?.response?.headers.get("Access-Control-Expose-Headers")).toBe("X-Custom-Header");
  });

  test("sets credentials header", () => {
    const ctx = createMockContext({
      method: "OPTIONS",
      config: { origin: "*", credentials: true },
    });

    const result = CorsPlugin.onRequest?.(ctx) as PluginResponse | undefined;

    expect(result?.response?.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });

  test("sets max age header", () => {
    const ctx = createMockContext({
      method: "OPTIONS",
      config: { origin: "*", maxAge: 3600 },
    });

    const result = CorsPlugin.onRequest?.(ctx) as PluginResponse | undefined;

    expect(result?.response?.headers.get("Access-Control-Max-Age")).toBe("3600");
  });

  test("sets Vary header", () => {
    const ctx = createMockContext({
      method: "OPTIONS",
      config: { origin: "*" },
    });

    const result = CorsPlugin.onRequest?.(ctx) as PluginResponse | undefined;

    expect(result?.response?.headers.get("Vary")).toBe("Origin");
  });

  test("does nothing for non-OPTIONS requests", () => {
    const ctx = createMockContext({
      method: "GET",
      config: { origin: "*" },
    });

    const result = CorsPlugin.onRequest?.(ctx);

    expect(result).toBeUndefined();
  });

  test("onResponse stores CORS headers in state", () => {
    const ctx = createMockContext({
      config: { origin: "*" },
    });

    void CorsPlugin.onResponse?.(ctx);

    const storedHeaders = ctx.state.get("cors-headers");
    expect(storedHeaders).toBeDefined();
    expect(storedHeaders).toBeInstanceOf(Headers);
  });
});
