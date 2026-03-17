import { test, expect, describe, vi } from "vite-plus/test";
import { LoggerPlugin } from "./logger.js";
import type { PluginContext } from "../types.js";

describe("LoggerPlugin", () => {
  const createMockContext = (overrides?: Partial<PluginContext>): PluginContext => ({
    request: new Request("http://example.com"),
    url: new URL("http://example.com"),
    method: "GET",
    headers: new Headers(),
    plugin: {
      id: "1",
      name: "logger",
      config: {},
      enabled: true,
      tags: [],
      consumerId: null,
      routeId: null,
      serviceId: null,
      priority: 90,
    },
    config: {},
    state: new Map(),
    waitUntil: () => {},
    ...overrides,
  });

  test("has correct metadata", () => {
    expect(LoggerPlugin.name).toBe("logger");
    expect(LoggerPlugin.version).toBe("1.0.0");
    expect(LoggerPlugin.priority).toBe(90);
    expect(LoggerPlugin.phases).toEqual(["request", "response"]);
  });

  test("onRequest stores start time in state", () => {
    const ctx = createMockContext({ config: { level: "debug" } });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    void LoggerPlugin.onRequest?.(ctx);

    const startTime = ctx.state.get("logger-start-time");
    expect(startTime).toBeDefined();
    expect(typeof startTime).toBe("number");

    consoleSpy.mockRestore();
  });

  test("onRequest logs in debug mode with JSON format", () => {
    const ctx = createMockContext({
      config: { level: "debug", format: "json" },
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    void LoggerPlugin.onRequest?.(ctx);

    expect(consoleSpy).toHaveBeenCalled();
    const loggedData = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(loggedData.type).toBe("request");
    expect(loggedData.method).toBe("GET");

    consoleSpy.mockRestore();
  });

  test("onRequest logs in debug mode with text format", () => {
    const ctx = createMockContext({
      config: { level: "debug", format: "text" },
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    void LoggerPlugin.onRequest?.(ctx);

    expect(consoleSpy).toHaveBeenCalled();
    const loggedText = consoleSpy.mock.calls[0][0];
    expect(loggedText).toContain("type=request");
    expect(loggedText).toContain("method=GET");

    consoleSpy.mockRestore();
  });

  test("onRequest does not log in info mode", () => {
    const ctx = createMockContext({
      config: { level: "info" },
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    void LoggerPlugin.onRequest?.(ctx);

    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  test("onResponse calculates duration", () => {
    const ctx = createMockContext({ config: { level: "info" } });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Set start time
    ctx.state.set("logger-start-time", Date.now() - 100);

    void LoggerPlugin.onResponse?.(ctx);

    expect(consoleSpy).toHaveBeenCalled();
    const loggedData = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(loggedData.type).toBe("response");
    expect(loggedData.duration).toMatch(/\d+ms/);

    consoleSpy.mockRestore();
  });

  test("onResponse handles missing start time", () => {
    const ctx = createMockContext({ config: { level: "info" } });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    void LoggerPlugin.onResponse?.(ctx);

    expect(consoleSpy).toHaveBeenCalled();
    const loggedData = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(loggedData.duration).toBe("0ms");

    consoleSpy.mockRestore();
  });

  test("onResponse logs in JSON format", () => {
    const ctx = createMockContext({
      config: { level: "info", format: "json" },
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    void LoggerPlugin.onResponse?.(ctx);

    expect(consoleSpy).toHaveBeenCalled();
    const loggedData = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(loggedData.type).toBe("response");
    expect(loggedData.method).toBe("GET");
    expect(loggedData.url).toBeDefined();

    consoleSpy.mockRestore();
  });

  test("onResponse logs in text format", () => {
    const ctx = createMockContext({
      config: { level: "info", format: "text" },
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    void LoggerPlugin.onResponse?.(ctx);

    expect(consoleSpy).toHaveBeenCalled();
    const loggedText = consoleSpy.mock.calls[0][0];
    expect(loggedText).toContain("type=response");
    expect(loggedText).toContain("method=GET");

    consoleSpy.mockRestore();
  });

  test("uses default config when not provided", () => {
    const ctx = createMockContext({ config: {} });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Should not throw with empty config
    expect(() => LoggerPlugin.onRequest?.(ctx)).not.toThrow();
    expect(() => void LoggerPlugin.onResponse?.(ctx)).not.toThrow();

    consoleSpy.mockRestore();
  });
});
