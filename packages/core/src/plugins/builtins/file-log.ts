import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { PluginContext, PluginDefinition } from "../types.js";
import { readBodyText } from "../runtime.js";

interface FileLogConfig {
  path: string;
  reopen?: boolean;
  include_body?: boolean;
}

export const FileLogPlugin: PluginDefinition = {
  name: "file-log",
  version: "1.0.0",
  displayName: "File Log",
  description: "Append structured request logs to a local file.",
  priority: 9,
  phases: ["log"],
  configDescriptor: {
    fields: [
      {
        key: "path",
        kind: "string",
        label: "Log file path",
        description: "The parent directory is created automatically when needed.",
        placeholder: "/var/log/minigateway/access.log",
        required: true,
      },
      {
        key: "include_body",
        kind: "boolean",
        label: "Include request and response bodies",
      },
    ],
  },

  onLog: async (ctx: PluginContext): Promise<void> => {
    const config = ctx.config as unknown as FileLogConfig;
    if (!config.path) {
      throw new Error("file-log plugin requires config.path");
    }

    const payload = {
      started_at: new Date(ctx.startedAt).toISOString(),
      request: {
        id: ctx.requestId,
        method: ctx.clientRequest.method,
        url: ctx.clientRequest.url.toString(),
        headers: Object.fromEntries(ctx.clientRequest.headers.entries()),
        body: config.include_body ? readBodyText(ctx.clientRequest.body) : undefined,
      },
      upstream_request: {
        method: ctx.request.method,
        url: ctx.request.url.toString(),
        headers: Object.fromEntries(ctx.request.headers.entries()),
        body: config.include_body ? readBodyText(ctx.request.body) : undefined,
      },
      route: ctx.route ? { id: ctx.route.id, name: ctx.route.name } : null,
      service: ctx.service ? { id: ctx.service.id, name: ctx.service.name } : null,
      target: ctx.target ? { id: ctx.target.id, target: ctx.target.target } : null,
      response: ctx.response
        ? {
            status: ctx.response.status,
            headers: Object.fromEntries(ctx.response.headers.entries()),
            body: config.include_body ? readBodyText(ctx.response.body) : undefined,
            source: ctx.response.source,
          }
        : null,
      latencies: {
        total: Date.now() - ctx.startedAt,
        upstream:
          ctx.upstreamStartedAt && ctx.upstreamCompletedAt
            ? ctx.upstreamCompletedAt - ctx.upstreamStartedAt
            : null,
      },
    };

    await ensureParentDir(config.path);
    await appendFile(config.path, `${JSON.stringify(payload)}\n`, "utf-8");
  },
};

async function ensureParentDir(filePath: string): Promise<void> {
  const parentDir = path.dirname(filePath);
  if (parentDir && parentDir !== "." && parentDir !== filePath) {
    await mkdir(parentDir, { recursive: true });
  }
}
