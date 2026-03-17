// Plugin Middleware for Hono
// Integrates PluginManager with Hono request handling

import type { Context, Next } from "hono";
import { PluginManager } from "../plugins/plugin-manager.js";
import type { PluginContext, PluginInstance } from "../plugins/types.js";
import type { Route, Service, Consumer } from "../entities/types.js";

/**
 * Plugin middleware options
 */
export interface PluginMiddlewareOptions {
  pluginManager: PluginManager;
  /** Get route from request (for route-matched plugins) */
  getRoute?: (c: Context) => Promise<Route | null>;
  /** Get service from request */
  getService?: (c: Context) => Promise<Service | null>;
  /** Get consumer from request (for consumer-specific plugins) */
  getConsumer?: (c: Context) => Promise<Consumer | null>;
}

/**
 * State keys used by plugin middleware
 */
export const PLUGIN_STATE_KEYS = {
  ROUTE: "plugin-route",
  SERVICE: "plugin-service",
  CONSUMER: "plugin-consumer",
  EXECUTED: "plugin-executed",
  RESPONSE_HEADERS: "plugin-response-headers",
} as const;

/**
 * Create plugin middleware for Hono
 *
 * The middleware executes plugins in the following order:
 * 1. Global plugins (all requests)
 * 2. Service plugins (if service is matched)
 * 3. Route plugins (if route is matched)
 * 4. Consumer plugins (if consumer is authenticated)
 *
 * @param options - Middleware options
 * @returns Hono middleware function
 */
export function createPluginMiddleware(options: PluginMiddlewareOptions) {
  const { pluginManager, getRoute, getService, getConsumer } = options;

  return async (c: Context, next: Next): Promise<void> => {
    const state = new Map<string, unknown>();

    // Create plugin context template
    const baseCtx: Omit<PluginContext, "plugin" | "config"> = {
      request: c.req.raw,
      url: new URL(c.req.url),
      method: c.req.method,
      headers: c.req.raw.headers,
      route: undefined,
      service: undefined,
      consumer: undefined,
      state,
      waitUntil: (promise: Promise<void>) => {
        // In Hono, we can use c.executionCtx.waitUntil if available
        // For now, just await it (fire-and-forget would require background task support)
        promise.catch((err) => console.error("waitUntil error:", err));
      },
    };

    // Collect all plugin instances to execute
    const allInstances: PluginInstance[] = [];

    // 1. Get global plugins
    const globalPlugins = await pluginManager.getGlobalPluginInstances();
    allInstances.push(...globalPlugins);

    // 2. Get service plugins
    if (getService) {
      const service = await getService(c);
      if (service) {
        baseCtx.service = service;
        state.set(PLUGIN_STATE_KEYS.SERVICE, service);
        const servicePlugins = await pluginManager.getPluginInstancesForService(service.id);
        allInstances.push(...servicePlugins);
      }
    }

    // 3. Get route plugins
    if (getRoute) {
      const route = await getRoute(c);
      if (route) {
        baseCtx.route = route;
        state.set(PLUGIN_STATE_KEYS.ROUTE, route);
        const serviceId = route.serviceId;
        const routePlugins = await pluginManager.getPluginInstancesForRoute(
          route.id,
          serviceId || undefined,
        );
        allInstances.push(...routePlugins);
      }
    }

    // 4. Get consumer plugins
    if (getConsumer) {
      const consumer = await getConsumer(c);
      if (consumer) {
        baseCtx.consumer = consumer;
        state.set(PLUGIN_STATE_KEYS.CONSUMER, consumer);
        const consumerPlugins = await pluginManager.getPluginInstancesForConsumer(consumer.id);
        allInstances.push(...consumerPlugins);
      }
    }

    // Execute onRequest phase
    const requestResult = await pluginManager.executeAllPluginInstances(
      "request",
      allInstances,
      baseCtx as PluginContext,
    );

    // If a plugin stopped execution, return the response
    if (requestResult.stopped && requestResult.response) {
      c.status(requestResult.response.status as any);
      requestResult.response.headers.forEach((value, key) => {
        c.header(key, value);
      });
      c.body(requestResult.response.body as any);
      return;
    }

    // If a plugin returned an error, throw it
    if (requestResult.error) {
      throw requestResult.error;
    }

    // Apply response headers from plugins
    const responseHeaders = state.get(PLUGIN_STATE_KEYS.RESPONSE_HEADERS) as Headers | undefined;
    if (responseHeaders) {
      responseHeaders.forEach((value, key) => {
        c.header(key, value);
      });
    }

    // Continue to next handler
    await next();

    // Execute onResponse phase (after the route handler has completed)
    const responseCtx: PluginContext = {
      ...baseCtx,
      plugin: {
        id: "response-phase",
        name: "response-phase",
        config: {},
        enabled: true,
      },
      config: {},
    };

    await pluginManager.executeAllPluginInstances("response", allInstances, responseCtx);

    // Apply any response headers set during response phase
    const finalResponseHeaders = state.get(PLUGIN_STATE_KEYS.RESPONSE_HEADERS) as
      | Headers
      | undefined;
    if (finalResponseHeaders) {
      finalResponseHeaders.forEach((value, key) => {
        c.header(key, value);
      });
    }
  };
}

/**
 * Helper to get/set state in plugin context
 */
export class PluginStateHelper {
  constructor(private state: Map<string, unknown>) {}

  get<T>(key: string): T | undefined {
    return this.state.get(key) as T | undefined;
  }

  set<T>(key: string, value: T): void {
    this.state.set(key, value);
  }

  has(key: string): boolean {
    return this.state.has(key);
  }

  delete(key: string): boolean {
    return this.state.delete(key);
  }
}
