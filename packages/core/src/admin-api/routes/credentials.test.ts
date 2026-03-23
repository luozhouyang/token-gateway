// Credentials Routes Tests

import { test, expect, beforeEach, afterEach, describe } from "vite-plus/test";
import { createTestContext, destroyTestContext } from "../test-utils.js";
import type { TestContext } from "../test-utils.js";

describe("Credentials Routes", () => {
  let ctx: TestContext;
  let consumerId: string;

  beforeEach(async () => {
    ctx = createTestContext();

    // Create a consumer for the tests
    const createResponse = await ctx.app.request("/admin/consumers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "test-user",
      }),
    });
    const created = await createResponse.json();
    consumerId = created.data.id;
  });

  afterEach(() => {
    destroyTestContext(ctx);
  });

  describe("POST /admin/consumers/:consumerId/credentials", () => {
    test("creates a credential", async () => {
      const body = {
        credentialType: "key-auth",
        credential: {
          key: "test-api-key",
        },
        tags: ["test"],
      };

      const response = await ctx.app.request(`/admin/consumers/${consumerId}/credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.data).toBeDefined();
      expect(json.data.credentialType).toBe("key-auth");
      expect(json.data.consumerId).toBe(consumerId);
      expect(json.data.credential).toEqual({ key: "test-api-key" });
    });

    test("returns 400 for missing required fields", async () => {
      const body = { credential: { key: "test" } };

      const response = await ctx.app.request(`/admin/consumers/${consumerId}/credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBeDefined();
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });

    test("returns 404 for non-existent consumer", async () => {
      const body = {
        credentialType: "key-auth",
        credential: { key: "test" },
      };

      const response = await ctx.app.request("/admin/consumers/non-existent-id/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error).toBeDefined();
      expect(json.error.code).toBe("NOT_FOUND");
    });

    test("returns 400 when key-auth credentials are missing credential.key", async () => {
      const response = await ctx.app.request(`/admin/consumers/${consumerId}/credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credentialType: "key-auth",
          credential: {},
        }),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error.code).toBe("BAD_REQUEST");
    });

    test("returns 409 when a key-auth credential key already exists", async () => {
      await ctx.app.request(`/admin/consumers/${consumerId}/credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credentialType: "key-auth",
          credential: { key: "duplicate-key" },
        }),
      });

      const response = await ctx.app.request(`/admin/consumers/${consumerId}/credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credentialType: "key-auth",
          credential: { key: "duplicate-key" },
        }),
      });

      expect(response.status).toBe(409);
      const json = await response.json();
      expect(json.error.code).toBe("CONFLICT");
    });
  });

  describe("GET /admin/consumers/:consumerId/credentials", () => {
    test("lists all credentials for a consumer", async () => {
      await ctx.app.request(`/admin/consumers/${consumerId}/credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credentialType: "key-auth",
          credential: { key: "key-1" },
        }),
      });

      await ctx.app.request(`/admin/consumers/${consumerId}/credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credentialType: "key-auth",
          credential: { key: "key-2" },
        }),
      });

      const response = await ctx.app.request(`/admin/consumers/${consumerId}/credentials`);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data).toHaveLength(2);
    });

    test("returns empty list for consumer with no credentials", async () => {
      // Create a new consumer without credentials
      const createResponse = await ctx.app.request("/admin/consumers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "user-no-creds",
        }),
      });
      const newConsumer = await createResponse.json();

      const response = await ctx.app.request(`/admin/consumers/${newConsumer.data.id}/credentials`);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data).toHaveLength(0);
    });
  });

  describe("GET /admin/consumers/:consumerId/credentials/:credentialId", () => {
    test("gets a credential by id", async () => {
      const createResponse = await ctx.app.request(`/admin/consumers/${consumerId}/credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credentialType: "key-auth",
          credential: { key: "test-key" },
        }),
      });
      const created = await createResponse.json();

      const response = await ctx.app.request(
        `/admin/consumers/${consumerId}/credentials/${created.data.id}`,
      );

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.id).toBe(created.data.id);
      expect(json.data.credentialType).toBe("key-auth");
    });

    test("returns 404 for non-existent credential", async () => {
      const response = await ctx.app.request(
        `/admin/consumers/${consumerId}/credentials/non-existent-id`,
      );

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error).toBeDefined();
    });
  });

  describe("PUT /admin/consumers/:consumerId/credentials/:credentialId", () => {
    test("updates a credential", async () => {
      const createResponse = await ctx.app.request(`/admin/consumers/${consumerId}/credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credentialType: "key-auth",
          credential: { key: "old-key" },
        }),
      });
      const created = await createResponse.json();

      const response = await ctx.app.request(
        `/admin/consumers/${consumerId}/credentials/${created.data.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            credential: { key: "new-key" },
            tags: ["updated"],
          }),
        },
      );

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.credential).toEqual({ key: "new-key" });
      expect(json.data.tags).toContain("updated");
    });

    test("returns 404 for non-existent credential", async () => {
      const response = await ctx.app.request(
        `/admin/consumers/${consumerId}/credentials/non-existent-id`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credential: { key: "new-key" } }),
        },
      );

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error).toBeDefined();
    });
  });

  describe("DELETE /admin/consumers/:consumerId/credentials/:credentialId", () => {
    test("deletes a credential", async () => {
      const createResponse = await ctx.app.request(`/admin/consumers/${consumerId}/credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credentialType: "key-auth",
          credential: { key: "test-key" },
        }),
      });
      const created = await createResponse.json();

      const deleteResponse = await ctx.app.request(
        `/admin/consumers/${consumerId}/credentials/${created.data.id}`,
        {
          method: "DELETE",
        },
      );

      expect(deleteResponse.status).toBe(200);
      const deleteJson = await deleteResponse.json();
      expect(deleteJson.data.deleted).toBe(true);

      // Verify credential is deleted
      const getResponse = await ctx.app.request(
        `/admin/consumers/${consumerId}/credentials/${created.data.id}`,
      );
      expect(getResponse.status).toBe(404);
    });

    test("returns 404 for non-existent credential", async () => {
      const response = await ctx.app.request(
        `/admin/consumers/${consumerId}/credentials/non-existent-id`,
        {
          method: "DELETE",
        },
      );

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error).toBeDefined();
    });
  });
});
