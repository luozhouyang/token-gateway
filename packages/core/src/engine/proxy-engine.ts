import { DatabaseService } from "../storage/database.js";
import { ServiceRepository } from "../entities/service.js";
import { RouteRepository } from "../entities/route.js";
import { UpstreamRepository } from "../entities/upstream.js";
import { TargetRepository } from "../entities/target.js";
import type { Route, Target } from "../storage/schema.js";
import { RouteMatcher } from "./route-matcher.js";
import { ProxyRequestHandler } from "./proxy-request-handler.js";
import type { Context } from "hono";
import {
  createLoadBalancer,
  HealthAwareLoadBalancer,
  type LoadBalancingAlgorithm,
} from "./load-balancer.js";
import { createLogger, getRequestId, type AppLogger } from "../utils/debug-logger.js";
import { PluginManager } from "../plugins/plugin-manager.js";

/**
 * Options for creating ProxyEngine
 */
export interface ProxyEngineOptions {
  /** Database path or DatabaseService instance */
  databasePath: string;
}

/**
 * ProxyEngine - Core request routing and load balancing engine
 *
 * Responsibilities:
 * - Route matching (path, method, host, headers)
 * - Load balancing across upstream targets
 * - Health check tracking
 */
export class ProxyEngine {
  private db: DatabaseService;
  private serviceRepo: ServiceRepository;
  private routeRepo: RouteRepository;
  private upstreamRepo: UpstreamRepository;
  private targetRepo: TargetRepository;

  // Route matcher
  private routeMatcher: RouteMatcher;

  // Load balancers per upstream: upstreamId -> HealthAwareLoadBalancer
  private loadBalancers: Map<string, HealthAwareLoadBalancer> = new Map();

  // Health status: targetId -> healthy boolean
  private healthStatus: Map<string, boolean> = new Map();
  private logger: AppLogger;
  private pluginManager: PluginManager;

  constructor(
    db: DatabaseService,
    options?: {
      logger?: AppLogger;
      pluginManager?: PluginManager;
    },
  ) {
    this.db = db;
    this.serviceRepo = new ServiceRepository(db);
    this.routeRepo = new RouteRepository(db);
    this.upstreamRepo = new UpstreamRepository(db);
    this.targetRepo = new TargetRepository(db);
    this.routeMatcher = new RouteMatcher();
    this.logger = options?.logger || createLogger({ scope: "proxy-engine" });
    this.pluginManager = options?.pluginManager ?? new PluginManager(db);
  }

  /**
   * Match incoming request to a route
   *
   * Matching priority:
   * 1. Host (if specified)
   * 2. Method (if specified)
   * 3. Path (exact match, then prefix match)
   * 4. Headers (if specified)
   *
   * @param request - Incoming HTTP request
   * @returns Matched route or null
   */
  async matchRoute(request: Request): Promise<Route | null> {
    const allRoutes = await this.routeRepo.findAll();
    return this.routeMatcher.match(allRoutes, request);
  }

  /**
   * Get or create a load balancer for an upstream
   */
  private getLoadBalancer(
    upstreamId: string,
    algorithm: LoadBalancingAlgorithm,
  ): HealthAwareLoadBalancer {
    let balancer = this.loadBalancers.get(upstreamId);
    if (!balancer) {
      const underlyingBalancer = createLoadBalancer(algorithm);
      balancer = new HealthAwareLoadBalancer(underlyingBalancer, (targetId) =>
        this.isHealthy(targetId),
      );
      this.loadBalancers.set(upstreamId, balancer);
    }
    return balancer;
  }

  /**
   * Select a target from upstream using configured load balancing algorithm
   *
   * @param targets - List of available targets
   * @param algorithm - Load balancing algorithm to use
   * @param request - Optional request for hash-based balancing
   * @returns Selected target or null if none available
   */
  selectTarget(
    targets: Target[],
    algorithm: LoadBalancingAlgorithm = "round-robin",
    request?: Request,
  ): Target | null {
    if (targets.length === 0) {
      return null;
    }

    const upstreamId = targets[0].upstreamId!;
    const balancer = this.getLoadBalancer(upstreamId, algorithm);

    // Use type assertion since LoadBalancerOptions is not exported
    return balancer.select({ targets, request } as any);
  }

  /**
   * Select a target with known upstream algorithm (synchronous version for tests)
   * @deprecated Use selectTarget instead
   */
  selectTargetWithAlgorithm(
    targets: Target[],
    algorithm: LoadBalancingAlgorithm = "round-robin",
    request?: Request,
  ): Target | null {
    return this.selectTarget(targets, algorithm, request);
  }

  /**
   * Mark target as unhealthy
   */
  markUnhealthy(targetId: string): void {
    this.healthStatus.set(targetId, false);
  }

  /**
   * Mark target as healthy
   */
  markHealthy(targetId: string): void {
    this.healthStatus.set(targetId, true);
  }

  /**
   * Check if target is healthy
   * Unknown targets are assumed healthy
   */
  isHealthy(targetId: string): boolean {
    const status = this.healthStatus.get(targetId);
    return status !== false; // undefined or true = healthy
  }

  /**
   * Get health status for all targets
   */
  getHealthStatus(): Map<string, boolean> {
    return new Map(this.healthStatus);
  }

  /**
   * Clear all health status
   */
  clearHealthStatus(): void {
    this.healthStatus.clear();
    this.loadBalancers.clear();
  }

  /**
   * Clear route matcher cache (useful for testing)
   */
  clearRouteMatcherCache(): void {
    this.routeMatcher.clearCache();
  }

  /**
   * Record a connection for least-connections load balancing (for testing)
   */
  recordConnection(targetId: string): void {
    // Find the load balancer and record connection on its underlying balancer
    for (const balancer of this.loadBalancers.values()) {
      // Access the underlying balancer if it's a LeastConnectionsLoadBalancer
      const underlyingBalancer = (balancer as any).balancer;
      if (
        underlyingBalancer &&
        typeof (underlyingBalancer as any).recordConnection === "function"
      ) {
        (underlyingBalancer as any).recordConnection(targetId);
      }
    }
  }

  /**
   * Release a connection for least-connections load balancing (for testing)
   */
  releaseConnection(targetId: string): void {
    // Find the load balancer and release connection on its underlying balancer
    for (const balancer of this.loadBalancers.values()) {
      // Access the underlying balancer if it's a LeastConnectionsLoadBalancer
      const underlyingBalancer = (balancer as any).balancer;
      if (
        underlyingBalancer &&
        typeof (underlyingBalancer as any).releaseConnection === "function"
      ) {
        (underlyingBalancer as any).releaseConnection(targetId);
      }
    }
  }

  /**
   * Handle Hono context - main entry point for proxy requests
   */
  async handle(c: Context): Promise<Response | null> {
    const requestId = getRequestId(c.req.raw);
    const requestLogger = this.logger.child("request");
    const handler = new ProxyRequestHandler(this.db, {
      logger: requestLogger,
      requestId,
      pluginManager: this.pluginManager,
    });
    const response = await handler.handleRequest(c.req.raw);

    if (!response) {
      requestLogger.debug("Proxy engine returned no response", {
        requestId,
        method: c.req.method,
        path: c.req.path,
      });
    }

    return response;
  }
}
