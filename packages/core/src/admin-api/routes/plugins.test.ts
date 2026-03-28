// Plugins Routes Tests

import { test, expect, beforeEach, afterEach, describe } from "vite-plus/test";
import { createTestContext, destroyTestContext } from "../test-utils.js";
import type { TestContext } from "../test-utils.js";

describe("Plugins Routes", () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  afterEach(() => {
    destroyTestContext(ctx);
  });

  describe("POST /admin/plugins", () => {
    test("creates a plugin binding", async () => {
      const body = {
        name: "key-auth",
        config: {
          key_names: ["apikey"],
        },
        enabled: true,
        tags: ["test"],
      };

      const response = await ctx.app.request("/admin/plugins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.data).toBeDefined();
      expect(json.data.name).toBe("key-auth");
      expect(json.data.enabled).toBe(true);
    });

    test("creates a plugin bound to a service", async () => {
      // First create a service
      const serviceResponse = await ctx.app.request("/admin/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "test-service",
          url: "http://localhost:8080",
          protocol: "http",
          host: "localhost",
          port: 8080,
        }),
      });
      const service = await serviceResponse.json();

      const body = {
        name: "cors",
        serviceId: service.data.id,
        config: {
          origins: ["*"],
        },
        enabled: true,
      };

      const response = await ctx.app.request("/admin/plugins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.data).toBeDefined();
      expect(json.data.name).toBe("cors");
      expect(json.data.serviceId).toBe(service.data.id);
    });

    test("returns 400 for missing required fields", async () => {
      const body = { name: "" };

      const response = await ctx.app.request("/admin/plugins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBeDefined();
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });

    test("creates an llm-router plugin with default config", async () => {
      const response = await ctx.app.request("/admin/plugins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "llm-router",
          config: {},
        }),
      });

      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.data.name).toBe("llm-router");
      expect(json.data.config).toEqual({
        clientProfile: "auto",
        requestTimeoutMs: 120000,
        maxRetries: 2,
        retryOnStatus: [429, 500, 502, 503, 504],
        clientRules: [],
        circuitBreaker: {
          failureThreshold: 4,
          successThreshold: 2,
          openTimeoutMs: 60000,
          minimumRequests: 10,
          errorRateThreshold: 0.6,
        },
        logging: {
          enabled: true,
          storeBodies: false,
        },
      });
    });

    test("returns 400 when llm-router config is invalid", async () => {
      const response = await ctx.app.request("/admin/plugins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "llm-router",
          config: {
            maxRetries: -1,
          },
        }),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBeDefined();
      expect(json.error.code).toBe("BAD_REQUEST");
    });
  });

  describe("GET /admin/plugins", () => {
    test("lists all plugins", async () => {
      await ctx.app.request("/admin/plugins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "key-auth",
          config: { key_names: ["apikey"] },
        }),
      });

      await ctx.app.request("/admin/plugins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "cors",
          config: { origins: ["*"] },
        }),
      });

      const response = await ctx.app.request("/admin/plugins");

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data).toHaveLength(2);
    });

    test("supports pagination", async () => {
      const response = await ctx.app.request("/admin/plugins?limit=5&offset=0");

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data).toBeDefined();
      expect(json.meta).toBeDefined();
    });

    test("filters by name", async () => {
      await ctx.app.request("/admin/plugins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "request-transformer",
          config: {
            add: {
              headers: ["x-filtered:true"],
            },
          },
        }),
      });

      const response = await ctx.app.request("/admin/plugins?name=request");

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data).toHaveLength(1);
      expect(json.data[0].name).toBe("request-transformer");
    });

    test("filters by enabled status", async () => {
      await ctx.app.request("/admin/plugins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "request-transformer",
          config: {
            add: {
              headers: ["x-enabled:true"],
            },
          },
          enabled: true,
        }),
      });

      await ctx.app.request("/admin/plugins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "response-transformer",
          config: {
            add: {
              headers: ["x-disabled:true"],
            },
          },
          enabled: false,
        }),
      });

      const response = await ctx.app.request("/admin/plugins?enabled=true");

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data).toHaveLength(1);
      expect(json.data[0].name).toBe("request-transformer");
    });

    test("filters by disabled status", async () => {
      await ctx.app.request("/admin/plugins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "request-transformer",
          config: {
            add: {
              headers: ["x-enabled:true"],
            },
          },
          enabled: true,
        }),
      });

      await ctx.app.request("/admin/plugins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "response-transformer",
          config: {
            add: {
              headers: ["x-disabled:true"],
            },
          },
          enabled: false,
        }),
      });

      const response = await ctx.app.request("/admin/plugins?enabled=false");

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data).toHaveLength(1);
      expect(json.data[0].name).toBe("response-transformer");
    });
  });

  describe("GET /admin/plugins/:id", () => {
    test("gets a plugin by id", async () => {
      const createResponse = await ctx.app.request("/admin/plugins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "request-transformer",
          config: {
            add: {
              headers: ["x-created:true"],
            },
          },
        }),
      });
      const created = await createResponse.json();

      const response = await ctx.app.request(`/admin/plugins/${created.data.id}`);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.id).toBe(created.data.id);
      expect(json.data.name).toBe("request-transformer");
    });

    test("returns 404 for non-existent plugin", async () => {
      const response = await ctx.app.request("/admin/plugins/non-existent-id");

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error).toBeDefined();
      expect(json.error.code).toBe("NOT_FOUND");
    });
  });

  describe("PUT /admin/plugins/:id", () => {
    test("updates a plugin", async () => {
      const createResponse = await ctx.app.request("/admin/plugins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "request-transformer",
          config: {
            add: {
              headers: ["x-test:old-value"],
            },
          },
          enabled: true,
        }),
      });
      const created = await createResponse.json();

      const response = await ctx.app.request(`/admin/plugins/${created.data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: {
            add: {
              headers: ["x-test:new-value"],
            },
          },
          enabled: false,
        }),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.config).toEqual({
        add: {
          headers: ["x-test:new-value"],
        },
      });
      expect(json.data.enabled).toBe(false);
    });

    test("returns 404 for non-existent plugin", async () => {
      const response = await ctx.app.request("/admin/plugins/non-existent-id", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      });

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error).toBeDefined();
    });
  });

  describe("DELETE /admin/plugins/:id", () => {
    test("deletes a plugin", async () => {
      const createResponse = await ctx.app.request("/admin/plugins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "cors",
          config: {
            origins: ["*"],
          },
        }),
      });
      const created = await createResponse.json();

      const deleteResponse = await ctx.app.request(`/admin/plugins/${created.data.id}`, {
        method: "DELETE",
      });

      expect(deleteResponse.status).toBe(200);
      const deleteJson = await deleteResponse.json();
      expect(deleteJson.data.deleted).toBe(true);

      // Verify plugin is deleted
      const getResponse = await ctx.app.request(`/admin/plugins/${created.data.id}`);
      expect(getResponse.status).toBe(404);
    });

    test("returns 404 for non-existent plugin", async () => {
      const response = await ctx.app.request("/admin/plugins/non-existent-id", {
        method: "DELETE",
      });

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error).toBeDefined();
    });
  });

  describe("GET /admin/plugins/definitions", () => {
    test("lists available plugin definitions with config descriptors", async () => {
      const response = await ctx.app.request("/admin/plugins/definitions");

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBeGreaterThan(0);

      const keyAuth = json.data.find(
        (definition: { name: string }) => definition.name === "key-auth",
      );
      expect(keyAuth).toMatchObject({
        name: "key-auth",
        displayName: "Key Auth",
        hasConfigSchema: true,
      });
      expect(keyAuth.configDescriptor.fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            key: "keyNames",
            kind: "string-list",
          }),
        ]),
      );

      const requestTransformer = json.data.find(
        (definition: { name: string }) => definition.name === "request-transformer",
      );
      expect(requestTransformer).toMatchObject({
        name: "request-transformer",
        displayName: "Request Transformer",
        hasConfigSchema: false,
      });
      expect(requestTransformer.configDescriptor.fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            key: "replace",
            kind: "object",
          }),
        ]),
      );
    });
  });
});
