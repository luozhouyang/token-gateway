import { match } from "path-to-regexp";
import type { Route } from "../storage/schema.js";

/**
 * Route matching result
 */
export interface RouteMatchResult {
  isExact: boolean;
  matchedPath: string;
  pathPattern: string;
}

type PathMatcher = ReturnType<typeof match>;

interface CachedPathMatcher {
  exactMatcher: PathMatcher;
  isPrefixPattern: boolean;
  isStaticPattern: boolean;
}

/**
 * RouteMatcher - Handles route matching logic
 *
 * Features:
 * - Path matching with path-to-regexp
 * - Header matching
 * - Route scoring by specificity
 */
export class RouteMatcher {
  // Path matcher cache: pathPattern -> matcher function
  private pathMatchers: Map<string, CachedPathMatcher> = new Map();

  /**
   * Match incoming request to a route
   *
   * Matching priority:
   * 1. Host (if specified)
   * 2. Method (if specified)
   * 3. Path (exact match, then prefix match)
   * 4. Headers (if specified)
   *
   * @param routes - List of routes to match against
   * @param request - Incoming HTTP request
   * @returns Matched route or null
   */
  async match(routes: Route[], request: Request): Promise<Route | null> {
    if (routes.length === 0) {
      return null;
    }

    const url = new URL(request.url);

    // Score and sort routes by specificity
    const scoredRoutes = routes
      .map((route) => ({ route, score: this.calculateScore(route, url, request) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score);

    if (scoredRoutes.length === 0) {
      return null;
    }

    return scoredRoutes[0].route;
  }

  /**
   * Calculate route matching score
   * Higher score = more specific match
   *
   * Scoring:
   * - Host match: 100 points
   * - Method match: 50 points
   * - Exact path match: 30 points
   * - Prefix path match: 20 points
   * - Header match: 40 points
   */
  private calculateScore(route: Route, url: URL, request: Request): number {
    let score = 0;

    // Host matching (high priority)
    if (route.hosts && route.hosts.length > 0) {
      const hostMatch = route.hosts.some(
        (h) => h === url.host || h === request.headers.get("host"),
      );
      if (!hostMatch) return 0;
      score += 100;
    }

    // Method matching
    if (route.methods && route.methods.length > 0) {
      const methodMatch = route.methods.includes(request.method);
      if (!methodMatch) return 0;
      score += 50;
    }

    // Path matching
    if (route.paths && route.paths.length > 0) {
      const pathMatch = this.matchRoutePath(route.paths, url.pathname);
      if (!pathMatch) return 0;
      // Exact match scores higher than prefix match
      score += pathMatch.isExact ? 30 : 20;
    }

    // Header matching
    if (route.headers) {
      const headerMatch = this.matchHeaders(route.headers, request.headers);
      if (!headerMatch) return 0;
      score += 40;
    }

    return score;
  }

  /**
   * Match path against route path patterns using path-to-regexp
   */
  matchRoutePath(routePaths: string[] | null, requestPath: string): RouteMatchResult | null {
    if (!routePaths || routePaths.length === 0) {
      return null;
    }

    return this.matchPath(routePaths, requestPath);
  }

  private matchPath(routePaths: string[], requestPath: string): RouteMatchResult | null {
    for (const pathPattern of routePaths) {
      const { exactMatcher, isPrefixPattern, isStaticPattern } = this.getPathMatcher(pathPattern);
      const exactResult = exactMatcher(requestPath);

      if (exactResult) {
        return {
          isExact: exactResult.path === requestPath,
          matchedPath: exactResult.path,
          pathPattern,
        };
      }

      const matchedPath = this.matchPrefixPath(pathPattern, requestPath, {
        isPrefixPattern,
        isStaticPattern,
      });
      if (matchedPath) {
        return {
          isExact: false,
          matchedPath,
          pathPattern,
        };
      }
    }
    return null;
  }

  /**
   * Get or create a path matcher with caching
   * Returns both the matcher and whether it's a prefix pattern
   */
  private getPathMatcher(pathPattern: string): CachedPathMatcher {
    const cached = this.pathMatchers.get(pathPattern);
    if (cached) {
      return cached;
    }

    const exactMatcher = match(this.normalizeExactPattern(pathPattern), {
      decode: decodeURIComponent,
    });
    const cachedMatcher = {
      exactMatcher,
      isPrefixPattern: pathPattern.endsWith("/") || pathPattern.endsWith("/*"),
      isStaticPattern: this.isStaticPathPattern(pathPattern),
    };
    this.pathMatchers.set(pathPattern, cachedMatcher);

    return cachedMatcher;
  }

  private normalizeExactPattern(pathPattern: string): string {
    if (pathPattern.endsWith("/*")) {
      return `${pathPattern}splat`;
    }

    return pathPattern;
  }

  private isStaticPathPattern(pathPattern: string): boolean {
    return !/[:*{}()[\]\\+?!]/.test(pathPattern);
  }

  private matchPrefixPath(
    pathPattern: string,
    requestPath: string,
    options: {
      isPrefixPattern: boolean;
      isStaticPattern: boolean;
    },
  ): string | null {
    if (pathPattern === "/") {
      return requestPath.startsWith("/") ? "/" : null;
    }

    if (pathPattern.endsWith("/*")) {
      return this.matchStaticPrefix(pathPattern.slice(0, -2), requestPath);
    }

    if (pathPattern.endsWith("/")) {
      const basePath = pathPattern.slice(0, -1);

      if (requestPath === pathPattern) {
        return pathPattern;
      }

      return this.matchStaticPrefix(basePath, requestPath);
    }

    if (options.isStaticPattern || options.isPrefixPattern) {
      return this.matchStaticPrefix(pathPattern, requestPath);
    }

    return null;
  }

  private matchStaticPrefix(basePath: string, requestPath: string): string | null {
    if (basePath.length === 0) {
      return requestPath.startsWith("/") ? "/" : null;
    }

    if (requestPath.startsWith(`${basePath}/`)) {
      return basePath;
    }

    return null;
  }

  /**
   * Match request headers against route header requirements
   */
  private matchHeaders(
    routeHeaders: Record<string, string | string[]>,
    requestHeaders: Headers,
  ): boolean {
    for (const [key, expectedValue] of Object.entries(routeHeaders)) {
      const actualValue = requestHeaders.get(key);
      if (!actualValue) return false;

      if (Array.isArray(expectedValue)) {
        if (!expectedValue.includes(actualValue)) return false;
      } else if (actualValue !== expectedValue) {
        return false;
      }
    }
    return true;
  }

  /**
   * Clear path matcher cache (useful for testing)
   */
  clearCache(): void {
    this.pathMatchers.clear();
  }

  /**
   * Get cache size (for testing)
   */
  getCacheSize(): number {
    return this.pathMatchers.size;
  }
}
