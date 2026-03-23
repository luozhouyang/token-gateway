import type { DatabaseService } from "../storage/database.js";
import { ServiceRepository } from "../entities/service.js";
import { RouteRepository } from "../entities/route.js";
import { UpstreamRepository } from "../entities/upstream.js";
import { TargetRepository } from "../entities/target.js";
import { RouteMatcher } from "./route-matcher.js";
import { createLoadBalancer, type LoadBalancingAlgorithm } from "./load-balancer.js";
import type { Route, Service, Target } from "../storage/schema.js";
import { createLogger, getRequestId, type AppLogger } from "../utils/debug-logger.js";

/**
 * Proxy Request Handler - Handles proxy requests with route matching
 *
 * This class encapsulates the proxy request handling logic,
 * including route matching, load balancing, and request forwarding.
 */
export class ProxyRequestHandler {
  private serviceRepo: ServiceRepository;
  private routeRepo: RouteRepository;
  private upstreamRepo: UpstreamRepository;
  private targetRepo: TargetRepository;
  private routeMatcher: RouteMatcher;
  private logger: AppLogger;
  private requestId?: string;

  constructor(
    db: DatabaseService,
    options?: {
      logger?: AppLogger;
      requestId?: string;
    },
  ) {
    this.serviceRepo = new ServiceRepository(db);
    this.routeRepo = new RouteRepository(db);
    this.upstreamRepo = new UpstreamRepository(db);
    this.targetRepo = new TargetRepository(db);
    this.routeMatcher = new RouteMatcher();
    this.logger = options?.logger || createLogger({ scope: "proxy-request-handler" });
    this.requestId = options?.requestId;
  }

  /**
   * Handle an incoming proxy request
   *
   * @param request - Incoming HTTP request
   * @returns Response from upstream or null if no route matches
   */
  async handleRequest(request: Request): Promise<Response | null> {
    const requestId = this.requestId || getRequestId(request);
    const requestUrl = new URL(request.url);

    this.logger.debug("Proxy request started", {
      requestId,
      method: request.method,
      path: requestUrl.pathname,
      search: requestUrl.search,
      host: requestUrl.host,
    });

    // 1. Match the request to a route
    const route = await this.matchRoute(request, requestId);

    if (!route) {
      // No matching route - return null to let caller handle
      this.logger.debug("Proxy request has no matching route", {
        requestId,
        method: request.method,
        path: requestUrl.pathname,
      });
      return null;
    }

    // 2. Get the service for this route
    if (!route.serviceId) {
      this.logger.warn("Matched route has no service binding", {
        requestId,
        routeId: route.id,
        routeName: route.name,
      });
      return new Response("Route has no associated service", { status: 502 });
    }
    const service = await this.serviceRepo.findById(route.serviceId);
    if (!service) {
      this.logger.warn("Matched route references missing service", {
        requestId,
        routeId: route.id,
        routeName: route.name,
        serviceId: route.serviceId,
      });
      return new Response("Service not found", { status: 502 });
    }

    this.logger.debug("Resolved service for matched route", {
      requestId,
      routeId: route.id,
      routeName: route.name,
      serviceId: service.id,
      serviceName: service.name,
      url: service.url,
      protocol: service.protocol,
      host: service.host,
      port: service.port,
      path: service.path,
    });

    // Check if service has upstream or direct connection info
    // Services now connect directly or through upstream
    let targets: Target[] = [];

    // Try to find upstream by checking if service has a name that matches upstream
    // For now, we'll look for targets with upstreamId matching service name
    // This is a temporary workaround - in real implementation, service should have upstreamId
    const allTargets = await this.targetRepo.findAll();
    targets = allTargets.filter((t) => t.upstreamId === service.id);

    if (targets.length === 0) {
      const directTarget = this.createDirectTarget(service, requestId);

      if (directTarget) {
        targets = [directTarget];
      } else {
        this.logger.warn("Service has no upstream targets or direct host configuration", {
          requestId,
          serviceId: service.id,
          serviceName: service.name,
          serviceUrl: service.url,
          servicePath: service.path,
        });
        return new Response("No upstream configured", { status: 502 });
      }
    } else {
      this.logger.debug("Loaded registered upstream targets for service", {
        requestId,
        serviceId: service.id,
        targetCount: targets.length,
        targets: targets.map((target) => ({
          id: target.id,
          target: target.target,
          weight: target.weight,
        })),
      });
    }

    // 4. Select a target using load balancing
    const target = this.selectTarget(targets, "round-robin", request);
    if (!target) {
      this.logger.warn("Unable to select upstream target", {
        requestId,
        serviceId: service.id,
        targetCount: targets.length,
      });
      return new Response("Unable to select target", { status: 503 });
    }

    this.logger.debug("Selected upstream target", {
      requestId,
      serviceId: service.id,
      routeId: route.id,
      targetId: target.id,
      target: target.target,
      algorithm: "round-robin",
    });

    // 5. Forward the request to the selected target
    const response = await this.forwardRequest(request, target, route, service, requestId);

    this.logger.debug("Proxy request completed", {
      requestId,
      routeId: route.id,
      routeName: route.name,
      serviceId: service.id,
      target: target.target,
      status: response.status,
    });

    return response;
  }

  /**
   * Match an incoming request to a configured route
   */
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
        paths: route.paths,
        methods: route.methods,
        hosts: route.hosts,
        stripPath: route.stripPath,
        pathPattern: pathMatch?.pathPattern ?? null,
        matchedPath: pathMatch?.matchedPath ?? null,
      });
    }

    return route;
  }

  /**
   * Select a target using the configured load balancing algorithm
   */
  private selectTarget(
    targets: Target[],
    algorithm: LoadBalancingAlgorithm,
    request: Request,
  ): Target | null {
    if (targets.length === 0) return null;

    const balancer = createLoadBalancer(algorithm);
    return balancer.select({ targets, request });
  }

  /**
   * Forward the request to the selected upstream target
   */
  private async forwardRequest(
    request: Request,
    target: Target,
    route: Route,
    service: Service,
    requestId: string,
  ): Promise<Response> {
    // Clone and modify the request for forwarding
    const url = new URL(request.url);
    const pathMatch = this.routeMatcher.matchRoutePath(route.paths, url.pathname);
    const forwardPath = this.resolveForwardPath(
      url.pathname,
      route,
      pathMatch?.matchedPath ?? null,
    );
    const serviceBasePath = this.resolveServiceBasePath(service, target);
    const upstreamUrl = this.resolveUpstreamUrl(target, service);
    upstreamUrl.pathname = this.joinUrlPaths(serviceBasePath, forwardPath);
    upstreamUrl.search = url.search;
    upstreamUrl.hash = "";
    const forwardUrl = upstreamUrl.toString();

    // Copy headers and add proxy-specific headers
    const headers = new Headers(request.headers);
    headers.set("X-Forwarded-For", request.headers.get("X-Forwarded-For") || url.hostname);
    headers.set("X-Forwarded-Proto", url.protocol.slice(0, -1));
    headers.set("X-Forwarded-Host", url.host);
    headers.set("X-Gateway-Service", service.name);
    headers.set("X-Request-ID", requestId);

    // Remove hop-by-hop headers
    headers.delete("Connection");
    headers.delete("Keep-Alive");
    headers.delete("Proxy-Authenticate");
    headers.delete("Proxy-Authorization");
    headers.delete("TE");
    headers.delete("Trailers");
    headers.delete("Transfer-Encoding");
    headers.delete("Upgrade");

    // Forward the request
    try {
      const startTime = Date.now();
      const fetchOptions: RequestInit = {
        method: request.method,
        headers,
        redirect: "manual",
      };

      // Add body for methods that support it
      if (request.method !== "GET" && request.method !== "HEAD") {
        fetchOptions.body = request.body;
        // Enable duplex streaming for Node.js
        (fetchOptions as any).duplex = "half";
      }

      this.logger.debug("Forwarding request to upstream", {
        requestId,
        routeId: route.id,
        routeName: route.name,
        target: target.target,
        upstreamUrl: forwardUrl,
        method: request.method,
        incomingPath: url.pathname,
        matchedPath: pathMatch?.matchedPath ?? null,
        stripPath: route.stripPath,
        preserveHost: route.preserveHost,
        serviceBasePath,
        forwardPath,
      });

      const response = await fetch(forwardUrl, fetchOptions);

      // Create response with CORS headers
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set("Access-Control-Allow-Origin", "*");
      responseHeaders.set("Access-Control-Expose-Headers", "*");
      responseHeaders.set("X-Request-ID", requestId);

      this.logger.debug("Received upstream response", {
        requestId,
        routeId: route.id,
        target: target.target,
        upstreamUrl: forwardUrl,
        status: response.status,
        durationMs: Date.now() - startTime,
      });

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (error) {
      this.logger.error("Proxy forward error", {
        requestId,
        routeId: route.id,
        routeName: route.name,
        target: target.target,
        upstreamUrl: forwardUrl,
        error,
      });
      return new Response(
        JSON.stringify({
          error: "Gateway Error",
          message: "Failed to forward request to upstream",
        }),
        {
          status: 502,
          headers: {
            "Content-Type": "application/json",
            "X-Request-ID": requestId,
          },
        },
      );
    }
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
        protocol: service.protocol ?? "http",
        servicePath: service.path,
      });

      return target;
    }

    if (!service.url) {
      return null;
    }

    let serviceUrl: URL;

    try {
      serviceUrl = new URL(service.url);
    } catch (error) {
      this.logger.warn("Service URL is invalid for direct proxying", {
        requestId,
        serviceId: service.id,
        serviceName: service.name,
        serviceUrl: service.url,
        error,
      });
      return null;
    }

    const target = {
      id: "direct-url",
      upstreamId: null,
      target: serviceUrl.host,
      weight: 100,
      tags: null,
      createdAt: new Date().toISOString(),
    } as Target;

    this.logger.debug("Using service URL as virtual target", {
      requestId,
      serviceId: service.id,
      serviceUrl: service.url,
      target: target.target,
      protocol: serviceUrl.protocol.slice(0, -1),
      servicePath: service.path,
      serviceUrlPath: serviceUrl.pathname,
    });

    return target;
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

    if (normalizedPath.endsWith("/")) {
      return normalizedPath.slice(0, -1);
    }

    return normalizedPath;
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
