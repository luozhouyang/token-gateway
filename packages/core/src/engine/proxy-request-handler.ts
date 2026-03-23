import type { DatabaseService } from "../storage/database.js";
import { ServiceRepository } from "../entities/service.js";
import { RouteRepository } from "../entities/route.js";
import { TargetRepository } from "../entities/target.js";
import { RouteMatcher, type RouteMatchResult } from "./route-matcher.js";
import { createLoadBalancer, type LoadBalancingAlgorithm } from "./load-balancer.js";
import type { Route, Service, Target } from "../storage/schema.js";
import { createLogger, getRequestId, type AppLogger } from "../utils/debug-logger.js";
import { PluginManager } from "../plugins/plugin-manager.js";
import type { PluginContext, PluginInstance } from "../plugins/types.js";
import {
  cloneArrayBuffer,
  createRequestState,
  readRequestBody,
  toFetchRequest,
  toResponse,
  toResponseState,
  type HttpRequestSnapshot,
} from "../plugins/runtime.js";

export class ProxyRequestHandler {
  private readonly serviceRepo: ServiceRepository;
  private readonly routeRepo: RouteRepository;
  private readonly targetRepo: TargetRepository;
  private readonly routeMatcher: RouteMatcher;
  private readonly logger: AppLogger;
  private readonly requestId?: string;
  private readonly pluginManager: PluginManager;

  constructor(
    db: DatabaseService,
    options?: {
      logger?: AppLogger;
      requestId?: string;
      pluginManager?: PluginManager;
    },
  ) {
    this.serviceRepo = new ServiceRepository(db);
    this.routeRepo = new RouteRepository(db);
    this.targetRepo = new TargetRepository(db);
    this.routeMatcher = new RouteMatcher();
    this.logger = options?.logger || createLogger({ scope: "proxy-request-handler" });
    this.requestId = options?.requestId;
    this.pluginManager = options?.pluginManager || new PluginManager(db);
  }

  async handleRequest(request: Request): Promise<Response | null> {
    const requestId = this.requestId || getRequestId(request);
    const requestUrl = new URL(request.url);
    const startedAt = Date.now();

    this.logger.debug("Proxy request started", {
      requestId,
      method: request.method,
      path: requestUrl.pathname,
      search: requestUrl.search,
      host: requestUrl.host,
    });

    const route = await this.matchRoute(request, requestId);
    if (!route) {
      this.logger.debug("Proxy request has no matching route", {
        requestId,
        method: request.method,
        path: requestUrl.pathname,
      });
      return null;
    }

    if (!route.serviceId) {
      this.logger.warn("Matched route has no service binding", {
        requestId,
        routeId: route.id,
        routeName: route.name,
      });
      return this.createGatewayErrorResponse("Route has no associated service", requestId);
    }

    const service = await this.serviceRepo.findById(route.serviceId);
    if (!service) {
      this.logger.warn("Matched route references missing service", {
        requestId,
        routeId: route.id,
        routeName: route.name,
        serviceId: route.serviceId,
      });
      return this.createGatewayErrorResponse("Service not found", requestId);
    }

    const targets = await this.resolveTargets(service, requestId);
    if (targets.length === 0) {
      this.logger.warn("Service has no upstream targets or direct host configuration", {
        requestId,
        serviceId: service.id,
        serviceName: service.name,
      });
      return this.createGatewayErrorResponse("No upstream configured", requestId);
    }

    const target = this.selectTarget(targets, "round-robin", request);
    if (!target) {
      this.logger.warn("Unable to select upstream target", {
        requestId,
        serviceId: service.id,
        targetCount: targets.length,
      });
      return this.createGatewayErrorResponse("Unable to select target", requestId, 503);
    }

    const requestBody = await readRequestBody(request);
    const pathMatch = this.routeMatcher.matchRoutePath(route.paths, requestUrl.pathname);
    const clientRequest = this.createClientRequestSnapshot(request, requestBody);
    const upstreamRequest = this.buildUpstreamRequest(
      request,
      requestBody,
      target,
      route,
      service,
      requestId,
      pathMatch,
    );
    const pluginInstances = await this.pluginManager.resolvePluginInstances({
      routeId: route.id,
      serviceId: service.id,
      consumerId: null,
    });
    const pluginCtx = this.createPluginContext({
      requestId,
      startedAt,
      clientRequest,
      upstreamRequest,
      route,
      service,
      target,
      uriCaptures: pathMatch?.captures ?? {},
    });

    const accessResult = await this.executeAccessPhase(pluginInstances, pluginCtx);
    if (accessResult.error) {
      pluginCtx.response = await toResponseState(
        this.createGatewayErrorResponse("Plugin access phase failed", requestId),
        "gateway",
      );
      return this.finalizeResponse(pluginInstances, pluginCtx);
    }

    if (accessResult.response) {
      pluginCtx.response = await toResponseState(accessResult.response, "gateway");
      return this.finalizeResponse(pluginInstances, pluginCtx);
    }

    pluginCtx.upstreamStartedAt = Date.now();
    try {
      this.logger.debug("Forwarding request to upstream", {
        requestId,
        routeId: route.id,
        routeName: route.name,
        target: target.target,
        upstreamUrl: pluginCtx.request.url.toString(),
        method: pluginCtx.request.method,
      });

      const upstreamResponse = await fetch(toFetchRequest(pluginCtx.request));
      pluginCtx.upstreamCompletedAt = Date.now();
      pluginCtx.response = await toResponseState(upstreamResponse, "upstream");
      pluginCtx.response.headers.set("x-request-id", requestId);

      this.logger.debug("Received upstream response", {
        requestId,
        routeId: route.id,
        target: target.target,
        upstreamUrl: pluginCtx.request.url.toString(),
        status: pluginCtx.response.status,
        durationMs: pluginCtx.upstreamCompletedAt - pluginCtx.upstreamStartedAt,
      });
    } catch (error) {
      pluginCtx.upstreamCompletedAt = Date.now();
      this.logger.error("Proxy forward error", {
        requestId,
        routeId: route.id,
        routeName: route.name,
        target: target.target,
        upstreamUrl: pluginCtx.request.url.toString(),
        error,
      });
      pluginCtx.response = await toResponseState(
        this.createGatewayErrorResponse("Failed to forward request to upstream", requestId),
        "gateway",
      );
    }

    return this.finalizeResponse(pluginInstances, pluginCtx);
  }

  private async finalizeResponse(
    pluginInstances: PluginInstance[],
    pluginCtx: PluginContext,
  ): Promise<Response> {
    const phasePluginInstances = await this.resolvePluginInstancesForContext(
      pluginCtx,
      pluginInstances,
    );
    await this.pluginManager.executePhase("response", phasePluginInstances, pluginCtx);
    await this.pluginManager.executePhase("log", phasePluginInstances, pluginCtx);

    if (!pluginCtx.response) {
      return this.createGatewayErrorResponse(
        "No response generated by proxy pipeline",
        pluginCtx.requestId,
      );
    }

    pluginCtx.response.headers.set("x-request-id", pluginCtx.requestId);
    return toResponse(pluginCtx.response);
  }

  private async executeAccessPhase(
    pluginInstances: PluginInstance[],
    pluginCtx: PluginContext,
  ): Promise<{ stopped: boolean; response?: Response; error?: Error }> {
    let resolvedInstances = pluginInstances;
    let resolvedConsumerId = pluginCtx.consumer?.id ?? null;
    const executedPluginIds = new Set<string>();

    while (true) {
      let shouldRecompute = false;

      for (const instance of resolvedInstances) {
        if (!instance.enabled || executedPluginIds.has(instance.id)) {
          continue;
        }

        const result = await this.pluginManager.executePlugin("access", instance, pluginCtx);
        executedPluginIds.add(instance.id);

        if (result.error || result.stopped || result.response) {
          return result;
        }

        const currentConsumerId = pluginCtx.consumer?.id ?? null;
        if (
          currentConsumerId &&
          currentConsumerId !== resolvedConsumerId &&
          pluginCtx.route &&
          pluginCtx.service
        ) {
          resolvedConsumerId = currentConsumerId;
          resolvedInstances = await this.pluginManager.resolvePluginInstances({
            routeId: pluginCtx.route.id,
            serviceId: pluginCtx.service.id,
            consumerId: currentConsumerId,
          });
          shouldRecompute = true;
          break;
        }
      }

      if (!shouldRecompute) {
        return { stopped: false };
      }
    }
  }

  private async resolvePluginInstancesForContext(
    pluginCtx: PluginContext,
    fallbackInstances: PluginInstance[],
  ): Promise<PluginInstance[]> {
    if (!pluginCtx.route || !pluginCtx.service) {
      return fallbackInstances;
    }

    return this.pluginManager.resolvePluginInstances({
      routeId: pluginCtx.route.id,
      serviceId: pluginCtx.service.id,
      consumerId: pluginCtx.consumer?.id ?? null,
    });
  }

  private createPluginContext(input: {
    requestId: string;
    startedAt: number;
    clientRequest: HttpRequestSnapshot;
    upstreamRequest: ReturnType<typeof createRequestState>;
    route: Route;
    service: Service;
    target: Target;
    uriCaptures: Record<string, string>;
  }): PluginContext {
    return {
      phase: "access",
      requestId: input.requestId,
      route: input.route,
      service: input.service,
      consumer: undefined,
      target: input.target,
      plugin: {
        id: "unbound",
        name: "unbound",
        config: {},
        enabled: true,
      },
      config: {},
      pluginStorage: undefined,
      clientRequest: input.clientRequest,
      request: input.upstreamRequest,
      response: undefined,
      shared: new Map(),
      uriCaptures: input.uriCaptures,
      logger: this.logger.child("plugins"),
      startedAt: input.startedAt,
      waitUntil: (promise: Promise<unknown>) => {
        promise.catch((error) => {
          this.logger.error("Plugin background task failed", {
            requestId: input.requestId,
            error,
          });
        });
      },
    };
  }

  private createClientRequestSnapshot(
    request: Request,
    requestBody: ArrayBuffer | null,
  ): HttpRequestSnapshot {
    return {
      method: request.method,
      url: new URL(request.url),
      headers: new Headers(request.headers),
      body: requestBody ? cloneArrayBuffer(requestBody) : null,
    };
  }

  private buildUpstreamRequest(
    request: Request,
    requestBody: ArrayBuffer | null,
    target: Target,
    route: Route,
    service: Service,
    requestId: string,
    pathMatch: RouteMatchResult | null,
  ) {
    const incomingUrl = new URL(request.url);
    const forwardPath = this.resolveForwardPath(
      incomingUrl.pathname,
      route,
      pathMatch?.matchedPath ?? null,
    );
    const serviceBasePath = this.resolveServiceBasePath(service, target);
    const upstreamUrl = this.resolveUpstreamUrl(target, service);
    upstreamUrl.pathname = this.joinUrlPaths(serviceBasePath, forwardPath);
    upstreamUrl.search = incomingUrl.search;
    upstreamUrl.hash = "";

    const snapshot: HttpRequestSnapshot = {
      method: request.method,
      url: upstreamUrl,
      headers: this.buildProxyHeaders(request, upstreamUrl, route, service, requestId),
      body: requestBody ? cloneArrayBuffer(requestBody) : null,
    };

    return createRequestState(snapshot);
  }

  private buildProxyHeaders(
    request: Request,
    upstreamUrl: URL,
    route: Route,
    service: Service,
    requestId: string,
  ): Headers {
    const incomingUrl = new URL(request.url);
    const headers = new Headers(request.headers);

    headers.set("x-forwarded-for", request.headers.get("x-forwarded-for") || incomingUrl.hostname);
    headers.set("x-forwarded-proto", incomingUrl.protocol.slice(0, -1));
    headers.set("x-forwarded-host", incomingUrl.host);
    headers.set("x-gateway-service", service.name);
    headers.set("x-request-id", requestId);
    headers.delete("connection");
    headers.delete("keep-alive");
    headers.delete("proxy-authenticate");
    headers.delete("proxy-authorization");
    headers.delete("te");
    headers.delete("trailers");
    headers.delete("transfer-encoding");
    headers.delete("upgrade");

    if (!route.preserveHost && upstreamUrl.host) {
      headers.set("host", upstreamUrl.host);
    }

    return headers;
  }

  private async resolveTargets(service: Service, requestId: string): Promise<Target[]> {
    const allTargets = await this.targetRepo.findAll();
    const boundTargets = allTargets.filter((target) => target.upstreamId === service.id);
    if (boundTargets.length > 0) {
      this.logger.debug("Loaded registered upstream targets for service", {
        requestId,
        serviceId: service.id,
        targetCount: boundTargets.length,
      });
      return boundTargets;
    }

    const directTarget = this.createDirectTarget(service, requestId);
    return directTarget ? [directTarget] : [];
  }

  private createGatewayErrorResponse(message: string, requestId: string, status = 502): Response {
    return new Response(
      JSON.stringify({
        error: "Gateway Error",
        message,
      }),
      {
        status,
        headers: {
          "content-type": "application/json",
          "x-request-id": requestId,
        },
      },
    );
  }

  private async matchRoute(request: Request, requestId: string): Promise<Route | null> {
    const allRoutes = await this.routeRepo.findAll();
    const requestPath = new URL(request.url).pathname;
    this.logger.debug("Loaded routes for matching", {
      requestId,
      routeCount: allRoutes.length,
    });

    const route = await this.routeMatcher.match(allRoutes, request);
    if (route) {
      const pathMatch = this.routeMatcher.matchRoutePath(route.paths, requestPath);
      this.logger.debug("Matched proxy route", {
        requestId,
        routeId: route.id,
        routeName: route.name,
        serviceId: route.serviceId,
        matchedPath: pathMatch?.matchedPath ?? null,
        captures: pathMatch?.captures ?? {},
      });
    }

    return route;
  }

  private selectTarget(
    targets: Target[],
    algorithm: LoadBalancingAlgorithm,
    request: Request,
  ): Target | null {
    if (targets.length === 0) {
      return null;
    }

    const balancer = createLoadBalancer(algorithm);
    return balancer.select({ targets, request });
  }

  private resolveForwardPath(
    requestPath: string,
    route: Route,
    matchedPath: string | null,
  ): string {
    if (!route.stripPath || !matchedPath) {
      return this.normalizeForwardPath(requestPath);
    }

    const strippedPath = requestPath.slice(matchedPath.length);
    return this.normalizeForwardPath(strippedPath);
  }

  private normalizeForwardPath(pathname: string): string {
    if (pathname.length === 0) {
      return "/";
    }

    return pathname.startsWith("/") ? pathname : `/${pathname}`;
  }

  private createDirectTarget(service: Service, requestId: string): Target | null {
    if (service.host) {
      const port = service.port ?? this.getDefaultPort(service.protocol);
      const target = {
        id: "direct-host",
        upstreamId: null,
        target: port ? `${service.host}:${port}` : service.host,
        weight: 100,
        tags: null,
        createdAt: new Date().toISOString(),
      } as Target;

      this.logger.debug("Using direct service host as virtual target", {
        requestId,
        serviceId: service.id,
        target: target.target,
      });

      return target;
    }

    if (!service.url) {
      return null;
    }

    try {
      const serviceUrl = new URL(service.url);
      return {
        id: "direct-url",
        upstreamId: null,
        target: serviceUrl.host,
        weight: 100,
        tags: null,
        createdAt: new Date().toISOString(),
      } as Target;
    } catch (error) {
      this.logger.warn("Service URL is invalid for direct proxying", {
        requestId,
        serviceId: service.id,
        serviceUrl: service.url,
        error,
      });
      return null;
    }
  }

  private resolveUpstreamUrl(target: Target, service: Service): URL {
    if (target.id === "direct-url" && service.url) {
      return new URL(service.url);
    }

    const protocol = service.protocol || "http";
    return new URL(`${protocol}://${target.target}`);
  }

  private resolveServiceBasePath(service: Service, target: Target): string {
    if (service.path) {
      return this.normalizeServiceBasePath(service.path);
    }

    if (target.id === "direct-url" && service.url) {
      return this.normalizeServiceBasePath(new URL(service.url).pathname);
    }

    return "";
  }

  private normalizeServiceBasePath(pathname: string): string {
    if (!pathname || pathname === "/") {
      return "";
    }

    const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
    return normalizedPath.endsWith("/") ? normalizedPath.slice(0, -1) : normalizedPath;
  }

  private joinUrlPaths(basePath: string, requestPath: string): string {
    if (!basePath) {
      return requestPath;
    }

    if (requestPath === "/") {
      return basePath;
    }

    return `${basePath}${requestPath}`;
  }

  private getDefaultPort(protocol?: string | null): number | null {
    if (protocol === "https" || protocol === "grpcs") {
      return 443;
    }

    if (protocol === "http" || protocol === "grpc" || !protocol) {
      return 80;
    }

    return null;
  }
}
