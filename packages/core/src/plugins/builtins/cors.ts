import type { PluginContext, PluginDefinition, PluginHandlerResult } from "../types.js";
import { appendVaryHeader } from "../runtime.js";

interface CorsConfig {
  origins?: string[];
  origin?: string | string[];
  methods?: string[];
  headers?: string[];
  allowedHeaders?: string[];
  exposed_headers?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  max_age?: number;
  maxAge?: number;
  private_network?: boolean;
  preflight_continue?: boolean;
}

export const CorsPlugin: PluginDefinition = {
  name: "cors",
  version: "2.0.0",
  displayName: "CORS",
  description: "Control cross-origin requests and preflight responses.",
  priority: 2000,
  phases: ["access", "response"],
  configDescriptor: {
    fields: [
      {
        key: "origins",
        kind: "string-list",
        label: "Allowed origins",
        description: "Use * to allow all origins. Credentials will reflect the request origin.",
        itemLabel: "Origin",
      },
      {
        key: "methods",
        kind: "string-list",
        label: "Allowed methods",
        description: "When empty, the runtime falls back to the default HTTP verb set.",
        itemLabel: "Method",
      },
      {
        key: "headers",
        kind: "string-list",
        label: "Allowed request headers",
        description: "Leave empty to mirror Access-Control-Request-Headers.",
        itemLabel: "Header",
      },
      {
        key: "exposed_headers",
        kind: "string-list",
        label: "Exposed response headers",
        itemLabel: "Header",
      },
      {
        key: "credentials",
        kind: "boolean",
        label: "Allow credentials",
      },
      {
        key: "max_age",
        kind: "number",
        label: "Preflight cache max age",
        description: "Maximum number of seconds browsers may cache the preflight response.",
        min: 0,
      },
      {
        key: "private_network",
        kind: "boolean",
        label: "Allow private network requests",
      },
      {
        key: "preflight_continue",
        kind: "boolean",
        label: "Continue after preflight",
        description: "Forward the OPTIONS request upstream instead of replying directly.",
      },
    ],
  },

  onAccess: (ctx: PluginContext): PluginHandlerResult | void => {
    const origin = ctx.clientRequest.headers.get("origin");
    if (!origin) {
      return;
    }

    if (!isPreflightRequest(ctx)) {
      return;
    }

    const responseHeaders = buildCorsHeaders(ctx, true);
    if (!responseHeaders.has("access-control-allow-origin")) {
      return {
        stop: true,
        response: new Response(null, { status: 403 }),
      };
    }

    if ((ctx.config as CorsConfig).preflight_continue) {
      return;
    }

    return {
      stop: true,
      response: new Response(null, {
        status: 204,
        headers: responseHeaders,
      }),
    };
  },

  onResponse: (ctx: PluginContext): void => {
    if (!ctx.response) {
      return;
    }

    const headers = buildCorsHeaders(ctx, false);
    headers.forEach((value, key) => {
      ctx.response?.headers.set(key, value);
    });
  },
};

function buildCorsHeaders(ctx: PluginContext, preflight: boolean): Headers {
  const config = normalizeConfig(ctx.config as CorsConfig);
  const requestHeaders = ctx.clientRequest.headers;
  const origin = requestHeaders.get("origin");
  const headers = new Headers();

  if (!origin) {
    return headers;
  }

  const allowedOrigin = resolveAllowedOrigin(origin, config);
  if (!allowedOrigin) {
    return headers;
  }

  headers.set("access-control-allow-origin", allowedOrigin);
  appendVaryHeader(headers, "Origin");

  if (config.credentials) {
    headers.set("access-control-allow-credentials", "true");
  }

  if (config.exposedHeaders.length > 0 && !preflight) {
    headers.set("access-control-expose-headers", config.exposedHeaders.join(", "));
  }

  if (!preflight) {
    return headers;
  }

  const requestedMethod =
    requestHeaders.get("access-control-request-method") || ctx.clientRequest.method;
  headers.set("access-control-allow-methods", config.methods.join(", "));
  if (!config.methods.includes(requestedMethod.toUpperCase())) {
    headers.delete("access-control-allow-origin");
    return headers;
  }

  const allowHeaders =
    config.headers.length > 0
      ? config.headers.join(", ")
      : requestHeaders.get("access-control-request-headers") || "";
  if (allowHeaders) {
    headers.set("access-control-allow-headers", allowHeaders);
    appendVaryHeader(headers, "Access-Control-Request-Headers");
  }

  if (config.maxAge > 0) {
    headers.set("access-control-max-age", String(config.maxAge));
  }

  if (
    config.privateNetwork &&
    requestHeaders.get("access-control-request-private-network")?.toLowerCase() === "true"
  ) {
    headers.set("access-control-allow-private-network", "true");
  }

  return headers;
}

function resolveAllowedOrigin(
  origin: string,
  config: ReturnType<typeof normalizeConfig>,
): string | null {
  if (config.origins.includes("*")) {
    return config.credentials ? origin : "*";
  }

  return config.origins.includes(origin) ? origin : null;
}

function isPreflightRequest(ctx: PluginContext): boolean {
  return (
    ctx.clientRequest.method === "OPTIONS" &&
    ctx.clientRequest.headers.has("access-control-request-method")
  );
}

function normalizeConfig(config: CorsConfig) {
  const configuredOrigins = config.origins ?? normalizeStringArray(config.origin) ?? ["*"];
  return {
    origins: configuredOrigins,
    methods: normalizeStringArray(config.methods) ?? [
      "GET",
      "HEAD",
      "PUT",
      "PATCH",
      "POST",
      "DELETE",
      "OPTIONS",
    ],
    headers:
      normalizeStringArray(config.headers) ?? normalizeStringArray(config.allowedHeaders) ?? [],
    exposedHeaders:
      normalizeStringArray(config.exposed_headers) ??
      normalizeStringArray(config.exposedHeaders) ??
      [],
    credentials: config.credentials === true,
    maxAge: config.max_age ?? config.maxAge ?? 0,
    privateNetwork: config.private_network === true,
  };
}

function normalizeStringArray(value?: string | string[] | null): string[] | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? value.map((item) => item.trim()) : [value.trim()];
}
