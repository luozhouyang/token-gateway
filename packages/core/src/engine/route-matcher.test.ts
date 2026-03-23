import { test, expect, describe, beforeEach } from "vite-plus/test";
import { RouteMatcher } from "./route-matcher.js";
import type { Route } from "../storage/schema.js";

const createRoute = (overrides?: Partial<Route>): Route => ({
  id: overrides?.id || "route-1",
  name: overrides?.name || "test-route",
  serviceId: overrides?.serviceId || "service-1",
  protocols: overrides?.protocols ?? ["http", "https"],
  methods: overrides?.methods ?? null,
  hosts: overrides?.hosts ?? null,
  paths: overrides?.paths ?? null,
  headers: overrides?.headers ?? null,
  snis: overrides?.snis ?? null,
  sources: overrides?.sources ?? null,
  destinations: overrides?.destinations ?? null,
  stripPath: overrides?.stripPath ?? false,
  preserveHost: overrides?.preserveHost ?? false,
  regexPriority: overrides?.regexPriority ?? 0,
  pathHandling: overrides?.pathHandling ?? "v0",
  tags: overrides?.tags ?? [],
  createdAt: overrides?.createdAt ?? new Date().toISOString(),
  updatedAt: overrides?.updatedAt ?? new Date().toISOString(),
});

describe("RouteMatcher", () => {
  let matcher: RouteMatcher;

  beforeEach(() => {
    matcher = new RouteMatcher();
  });

  describe("match", () => {
    test("returns null for empty routes", async () => {
      const request = new Request("http://example.com/api/test");
      const result = await matcher.match([], request);
      expect(result).toBeNull();
    });

    test("returns null when no route matches", async () => {
      const routes = [
        createRoute({ paths: ["/api/users"] }),
        createRoute({ paths: ["/api/posts"] }),
      ];
      const request = new Request("http://example.com/api/test");
      const result = await matcher.match(routes, request);
      expect(result).toBeNull();
    });

    test("matches route by exact path", async () => {
      const route = createRoute({ paths: ["/api/test"] });
      const routes = [route];
      const request = new Request("http://example.com/api/test");
      const result = await matcher.match(routes, request);
      expect(result?.id).toBe(route.id);
    });

    test("matches route by path prefix", async () => {
      const route = createRoute({ paths: ["/api/"] });
      const routes = [route];
      const request = new Request("http://example.com/api/users/123");
      const result = await matcher.match(routes, request);
      expect(result?.id).toBe(route.id);
    });

    test("treats a static path as a prefix match for nested paths", async () => {
      const route = createRoute({ paths: ["/httpbin"] });
      const routes = [route];
      const request = new Request("http://example.com/httpbin/anything");
      const result = await matcher.match(routes, request);
      expect(result?.id).toBe(route.id);
    });

    test("does not treat a static path as a loose string prefix", async () => {
      const route = createRoute({ paths: ["/httpbin"] });
      const routes = [route];
      const request = new Request("http://example.com/httpbinx/anything");
      const result = await matcher.match(routes, request);
      expect(result).toBeNull();
    });

    test("matches route by method", async () => {
      const route = createRoute({ paths: ["/api"], methods: ["POST"] });
      const routes = [route];
      const request = new Request("http://example.com/api", { method: "POST" });
      const result = await matcher.match(routes, request);
      expect(result?.id).toBe(route.id);
    });

    test("does not match when method does not match", async () => {
      const route = createRoute({ paths: ["/api"], methods: ["POST"] });
      const routes = [route];
      const request = new Request("http://example.com/api", { method: "GET" });
      const result = await matcher.match(routes, request);
      expect(result).toBeNull();
    });

    test("matches route by host", async () => {
      const route = createRoute({ paths: ["/"], hosts: ["api.example.com"] });
      const routes = [route];
      const request = new Request("http://api.example.com/test");
      const result = await matcher.match(routes, request);
      expect(result?.id).toBe(route.id);
    });

    test("does not match when host does not match", async () => {
      const route = createRoute({ paths: ["/"], hosts: ["api.example.com"] });
      const routes = [route];
      const request = new Request("http://other.com/test");
      const result = await matcher.match(routes, request);
      expect(result).toBeNull();
    });

    test("matches route by header", async () => {
      const route = createRoute({
        paths: ["/api"],
        headers: { "x-api-key": "test-key" },
      });
      const routes = [route];
      const request = new Request("http://example.com/api", {
        headers: { "x-api-key": "test-key" },
      });
      const result = await matcher.match(routes, request);
      expect(result?.id).toBe(route.id);
    });

    test("does not match when header does not match", async () => {
      const route = createRoute({
        paths: ["/api"],
        headers: { "x-api-key": "test-key" },
      });
      const routes = [route];
      const request = new Request("http://example.com/api", {
        headers: { "x-api-key": "wrong-key" },
      });
      const result = await matcher.match(routes, request);
      expect(result).toBeNull();
    });

    test("matches route by header with array of values", async () => {
      const route = createRoute({
        paths: ["/api"],
        headers: { "x-api-key": ["key-1", "key-2"] },
      });
      const routes = [route];
      const request = new Request("http://example.com/api", {
        headers: { "x-api-key": "key-2" },
      });
      const result = await matcher.match(routes, request);
      expect(result?.id).toBe(route.id);
    });

    test("does not match when header value not in array", async () => {
      const route = createRoute({
        paths: ["/api"],
        headers: { "x-api-key": ["key-1", "key-2"] },
      });
      const routes = [route];
      const request = new Request("http://example.com/api", {
        headers: { "x-api-key": "key-3" },
      });
      const result = await matcher.match(routes, request);
      expect(result).toBeNull();
    });

    test("returns null when header is missing from request", async () => {
      const route = createRoute({
        paths: ["/api"],
        headers: { "x-api-key": "test-key" },
      });
      const routes = [route];
      const request = new Request("http://example.com/api");
      const result = await matcher.match(routes, request);
      expect(result).toBeNull();
    });
  });

  describe("route scoring", () => {
    test("exact path match scores higher than prefix match", async () => {
      const exactRoute = createRoute({
        id: "exact",
        name: "exact-route",
        paths: ["/api/test"], // Exact match for /api/test
      });
      const prefixRoute = createRoute({
        id: "prefix",
        name: "prefix-route",
        paths: ["/api/"], // Prefix match for /api/test
      });
      const routes = [prefixRoute, exactRoute];
      const request = new Request("http://example.com/api/test");
      const result = await matcher.match(routes, request);
      // Both routes match, but exact path (30 points) should score higher than prefix (20 points)
      expect(result?.id).toBe("exact");
    });

    test("exact static path match scores higher than an implicit prefix match", async () => {
      const exactRoute = createRoute({
        id: "exact",
        name: "exact-route",
        paths: ["/httpbin/anything"],
      });
      const prefixRoute = createRoute({
        id: "prefix",
        name: "prefix-route",
        paths: ["/httpbin"],
      });
      const routes = [prefixRoute, exactRoute];
      const request = new Request("http://example.com/httpbin/anything");
      const result = await matcher.match(routes, request);
      expect(result?.id).toBe("exact");
    });

    test("host match scores higher than path match", async () => {
      const hostRoute = createRoute({
        id: "host",
        name: "host-route",
        paths: ["/"],
        hosts: ["api.example.com"],
      });
      const pathRoute = createRoute({
        id: "path",
        name: "path-route",
        paths: ["/api/test"],
      });
      const routes = [pathRoute, hostRoute];
      const request = new Request("http://api.example.com/api/test");
      const result = await matcher.match(routes, request);
      expect(result?.id).toBe("host");
    });

    test("multiple conditions add up", async () => {
      const basicRoute = createRoute({
        id: "basic",
        name: "basic-route",
        paths: ["/api"],
      });
      const specificRoute = createRoute({
        id: "specific",
        name: "specific-route",
        paths: ["/api"],
        methods: ["POST"],
        headers: { "x-api-key": "test" },
      });
      const routes = [basicRoute, specificRoute];
      const request = new Request("http://example.com/api", {
        method: "POST",
        headers: { "x-api-key": "test" },
      });
      const result = await matcher.match(routes, request);
      expect(result?.id).toBe("specific");
    });
  });

  describe("path matcher cache", () => {
    test("caches path matchers", async () => {
      const route = createRoute({ paths: ["/api/test"] });
      const routes = [route];

      // First request - cache miss
      await matcher.match(routes, new Request("http://example.com/api/test"));
      expect(matcher.getCacheSize()).toBe(1);

      // Second request with same path - cache hit
      await matcher.match(routes, new Request("http://example.com/api/test"));
      expect(matcher.getCacheSize()).toBe(1); // Still 1, not 2
    });

    test("different paths create separate cache entries", async () => {
      const route1 = createRoute({ id: "r1", paths: ["/api/users"] });
      const route2 = createRoute({ id: "r2", paths: ["/api/posts"] });
      const routes = [route1, route2];

      await matcher.match(routes, new Request("http://example.com/api/users"));
      await matcher.match(routes, new Request("http://example.com/api/posts"));

      expect(matcher.getCacheSize()).toBe(2);
    });

    test("clears cache", async () => {
      const route = createRoute({ paths: ["/api/test"] });
      const routes = [route];

      await matcher.match(routes, new Request("http://example.com/api/test"));
      expect(matcher.getCacheSize()).toBe(1);

      matcher.clearCache();
      expect(matcher.getCacheSize()).toBe(0);
    });
  });

  describe("path-to-regexp patterns", () => {
    test("matches path with parameters", async () => {
      const route = createRoute({ paths: ["/api/users/:id"] });
      const routes = [route];
      const request = new Request("http://example.com/api/users/123");
      const result = await matcher.match(routes, request);
      expect(result?.id).toBe(route.id);
    });

    test("matches path with wildcard", async () => {
      const route = createRoute({ paths: ["/api/*splat"] });
      const routes = [route];
      const request = new Request("http://example.com/api/users/123/posts");
      const result = await matcher.match(routes, request);
      expect(result?.id).toBe(route.id);
    });

    test("matches path with optional parameter", async () => {
      const route = createRoute({ paths: ["/api/users{/:id}"] });
      const routes = [route];

      // Without optional param
      const request1 = new Request("http://example.com/api/users");
      const result1 = await matcher.match(routes, request1);
      expect(result1?.id).toBe(route.id);

      // With optional param
      const request2 = new Request("http://example.com/api/users/123");
      const result2 = await matcher.match(routes, request2);
      expect(result2?.id).toBe(route.id);
    });

    test("trailing slash is treated as prefix match", async () => {
      const route = createRoute({ paths: ["/api/"] });
      const routes = [route];

      // Should match with trailing path
      const request = new Request("http://example.com/api/users/123");
      const result = await matcher.match(routes, request);
      expect(result?.id).toBe(route.id);
    });
  });
});
