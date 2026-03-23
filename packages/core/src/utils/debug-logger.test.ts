import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { createLogger, normalizeLogLevel } from "./debug-logger.js";

describe("debug-logger", () => {
  const originalLogLevel = process.env.TOKEN_GATEWAY_LOG_LEVEL;

  afterEach(() => {
    vi.restoreAllMocks();

    if (originalLogLevel === undefined) {
      delete process.env.TOKEN_GATEWAY_LOG_LEVEL;
    } else {
      process.env.TOKEN_GATEWAY_LOG_LEVEL = originalLogLevel;
    }
  });

  test("normalizes invalid log levels to info", () => {
    expect(normalizeLogLevel("DEBUG")).toBe("debug");
    expect(normalizeLogLevel("invalid")).toBe("info");
  });

  test("emits debug logs only when debug level is enabled", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const logger = createLogger({
      scope: "proxy",
      level: "debug",
    });

    logger.debug("Matched route", {
      requestId: "req-1",
      routeId: "route-1",
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0]?.[0]).toContain('"scope":"proxy"');
    expect(logSpy.mock.calls[0]?.[0]).toContain('"message":"Matched route"');
  });

  test("suppresses debug logs when current level is info", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const logger = createLogger({
      scope: "proxy",
      level: "info",
    });

    logger.debug("This should not be emitted");

    expect(logSpy).not.toHaveBeenCalled();
  });
});
