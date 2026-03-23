import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { LoggerPlugin } from "./logger.js";
import { createPluginTestContext } from "../test-context.js";

describe("LoggerPlugin", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("logs request details in debug mode during access phase", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const ctx = createPluginTestContext({
      config: { level: "debug" },
    });

    await LoggerPlugin.onAccess?.(ctx);

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy.mock.calls[0]?.[0]).toContain('"type":"request"');
  });

  test("logs final response details during log phase", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const ctx = createPluginTestContext({
      phase: "log",
      response: {
        status: 201,
        statusText: "Created",
        headers: new Headers(),
        body: null,
        source: "upstream",
      },
    });

    await LoggerPlugin.onLog?.(ctx);

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy.mock.calls[0]?.[0]).toContain('"status":201');
  });
});
