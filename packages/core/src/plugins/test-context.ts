import { createLogger } from "../utils/debug-logger.js";
import { createRequestState, type HttpRequestSnapshot, type HttpResponseState } from "./runtime.js";
import type { PluginContext, PluginInstance } from "./types.js";

export function createPluginTestContext(overrides?: Partial<PluginContext>): PluginContext {
  const clientRequest: HttpRequestSnapshot =
    overrides?.clientRequest ??
    ({
      method: "GET",
      url: new URL("http://gateway.test/source?foo=bar"),
      headers: new Headers(),
      body: null,
    } satisfies HttpRequestSnapshot);

  const plugin: PluginInstance =
    overrides?.plugin ??
    ({
      id: "plugin-1",
      name: "test-plugin",
      config: {},
      enabled: true,
      priority: 100,
    } satisfies PluginInstance);

  const request = overrides?.request ?? createRequestState(clientRequest);
  const response = overrides?.response as HttpResponseState | undefined;

  return {
    phase: overrides?.phase ?? "access",
    requestId: overrides?.requestId ?? "req-1",
    route: overrides?.route,
    service: overrides?.service,
    consumer: overrides?.consumer,
    target: overrides?.target,
    plugin,
    config: overrides?.config ?? plugin.config ?? {},
    pluginStorage: overrides?.pluginStorage,
    clientRequest,
    request,
    response,
    shared: overrides?.shared ?? new Map(),
    uriCaptures: overrides?.uriCaptures ?? {},
    logger: overrides?.logger ?? createLogger({ scope: "plugin-test", level: "debug" }),
    startedAt: overrides?.startedAt ?? Date.now(),
    upstreamStartedAt: overrides?.upstreamStartedAt,
    upstreamCompletedAt: overrides?.upstreamCompletedAt,
    waitUntil: overrides?.waitUntil ?? (() => undefined),
  };
}
