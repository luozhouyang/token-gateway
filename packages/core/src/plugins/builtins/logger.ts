import type { PluginContext, PluginDefinition } from "../types.js";

export const LoggerPlugin: PluginDefinition = {
  name: "logger",
  version: "2.0.0",
  displayName: "Logger",
  description: "Write request and response activity to the process log.",
  priority: 4,
  phases: ["access", "log"],
  configDescriptor: {
    fields: [
      {
        key: "level",
        kind: "select",
        label: "Log level",
        description: "Debug includes request headers and routing context.",
        options: [
          { label: "Debug", value: "debug" },
          { label: "Info", value: "info" },
          { label: "Warn", value: "warn" },
          { label: "Error", value: "error" },
        ],
      },
      {
        key: "format",
        kind: "select",
        label: "Output format",
        options: [
          { label: "JSON", value: "json" },
          { label: "Text", value: "text" },
        ],
      },
    ],
  },

  onAccess: (ctx: PluginContext): void => {
    const level = getLevel(ctx);
    if (level !== "debug") {
      return;
    }

    writeLog(ctx, {
      type: "request",
      request_id: ctx.requestId,
      method: ctx.clientRequest.method,
      url: ctx.clientRequest.url.toString(),
      headers: Object.fromEntries(ctx.clientRequest.headers.entries()),
      route_id: ctx.route?.id || null,
      service_id: ctx.service?.id || null,
      target: ctx.target?.target || null,
      timestamp: new Date().toISOString(),
    });
  },

  onLog: (ctx: PluginContext): void => {
    writeLog(ctx, {
      type: "response",
      request_id: ctx.requestId,
      method: ctx.clientRequest.method,
      url: ctx.clientRequest.url.toString(),
      upstream_url: ctx.request.url.toString(),
      status: ctx.response?.status ?? 0,
      duration_ms: Date.now() - ctx.startedAt,
      timestamp: new Date().toISOString(),
    });
  },
};

function getLevel(ctx: PluginContext): string {
  const config = ctx.config as {
    level?: "debug" | "info" | "warn" | "error";
  };

  return config.level || "info";
}

function writeLog(ctx: PluginContext, payload: Record<string, unknown>): void {
  const config = ctx.config as {
    format?: "json" | "text";
  };

  if (config.format === "text") {
    const text = Object.entries(payload)
      .map(([key, value]) => `${key}=${String(value)}`)
      .join(" ");
    console.log(text);
    return;
  }

  console.log(JSON.stringify(payload));
}
