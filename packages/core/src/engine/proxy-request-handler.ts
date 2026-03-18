import type { DatabaseService } from "../storage/database.js";
import { ServiceRepository } from "../entities/service.js";
import { RouteRepository } from "../entities/route.js";
import { UpstreamRepository } from "../entities/upstream.js";
import { TargetRepository } from "../entities/target.js";
import { RouteMatcher } from "./route-matcher.js";
import { createLoadBalancer, type LoadBalancingAlgorithm } from "./load-balancer.js";
import type { Route, Target } from "../storage/schema.js";

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

  constructor(db: DatabaseService) {
    this.serviceRepo = new ServiceRepository(db);
    this.routeRepo = new RouteRepository(db);
    this.upstreamRepo = new UpstreamRepository(db);
    this.targetRepo = new TargetRepository(db);
    this.routeMatcher = new RouteMatcher();
  }

  /**
   * Handle an incoming proxy request
   *
   * @param request - Incoming HTTP request
   * @returns Response from upstream or null if no route matches
   */
  async handleRequest(request: Request): Promise<Response | null> {
    // 1. Match the request to a route
    const route = await this.matchRoute(request);

    if (!route) {
      // No matching route - return null to let caller handle
      return null;
    }

    // 2. Get the service for this route
    if (!route.serviceId) {
      return new Response("Route has no associated service", { status: 502 });
    }
    const service = await this.serviceRepo.findById(route.serviceId);
    if (!service) {
      return new Response("Service not found", { status: 502 });
    }

    // Check if service has upstream or direct connection info
    // Services now connect directly or through upstream
    let targets: Target[] = [];

    // Try to find upstream by checking if service has a name that matches upstream
    // For now, we'll look for targets with upstreamId matching service name
    // This is a temporary workaround - in real implementation, service should have upstreamId
    const allTargets = await this.targetRepo.findAll();
    targets = allTargets.filter((t) => t.upstreamId === service.id);

    if (targets.length === 0) {
      // Service has no upstream targets, use direct connection
      if (service.host) {
        // Create a virtual target from service configuration
        targets = [
          {
            id: "direct",
            upstreamId: null,
            target: `${service.host}:${service.port || 80}`,
            weight: 100,
            tags: null,
            createdAt: new Date().toISOString(),
          } as Target,
        ];
      } else {
        return new Response("No upstream configured", { status: 502 });
      }
    }

    // 4. Select a target using load balancing
    const target = this.selectTarget(targets, "round-robin", request);
    if (!target) {
      return new Response("Unable to select target", { status: 503 });
    }

    // 5. Forward the request to the selected target
    return this.forwardRequest(request, target, route, service);
  }

  /**
   * Match an incoming request to a configured route
   */
  private async matchRoute(request: Request): Promise<Route | null> {
    const allRoutes = await this.routeRepo.findAll();
    return this.routeMatcher.match(allRoutes, request);
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
    service: { name: string; protocol?: string | null },
  ): Promise<Response> {
    // Build target URL - target.target contains "host:port" format
    const protocol = service.protocol || "http";
    const targetUrl = `${protocol}://${target.target}`;

    // Clone and modify the request for forwarding
    const url = new URL(request.url);
    const forwardUrl = `${targetUrl}${url.pathname}${url.search}`;

    // Copy headers and add proxy-specific headers
    const headers = new Headers(request.headers);
    headers.set("X-Forwarded-For", request.headers.get("X-Forwarded-For") || url.hostname);
    headers.set("X-Forwarded-Proto", url.protocol.slice(0, -1));
    headers.set("X-Forwarded-Host", url.host);
    headers.set("X-Gateway-Service", service.name);

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

      const response = await fetch(forwardUrl, fetchOptions);

      // Create response with CORS headers
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set("Access-Control-Allow-Origin", "*");
      responseHeaders.set("Access-Control-Expose-Headers", "*");

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (error) {
      console.error("Proxy forward error:", error);
      return new Response(
        JSON.stringify({
          error: "Gateway Error",
          message: "Failed to forward request to upstream",
        }),
        {
          status: 502,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }
  }
}
