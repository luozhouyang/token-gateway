// Credentials Routes

import { Hono } from "hono";
import { zodValidator } from "../middleware/zod-validator.js";
import { createCredentialSchema, updateCredentialSchema } from "../schemas.js";
import { toCredentialResponse, successResponse, listResponse } from "../responses.js";
import { ApiError } from "../server.js";
import { CredentialRepository } from "../../entities/credential.js";
import { ConsumerRepository } from "../../entities/consumer.js";
import { DatabaseService } from "../../storage/database.js";

export function createCredentialsRoutes(db: DatabaseService) {
  const routes = new Hono();
  const credentialRepo = new CredentialRepository(db);
  const consumerRepo = new ConsumerRepository(db);

  // List credentials for a consumer
  routes.get("/consumers/:consumerId/credentials", async (c) => {
    const { consumerId } = c.req.param();
    const limit = parseInt(c.req.query("limit") || "20", 10);
    const offset = parseInt(c.req.query("offset") || "0", 10);

    // Verify consumer exists
    const consumer = await consumerRepo.findById(consumerId);
    if (!consumer) {
      throw ApiError.notFound("Consumer");
    }

    const credentials = await credentialRepo.findAll({
      limit,
      offset,
      orderBy: "createdAt",
      order: "desc",
    });

    // Filter by consumer
    const filtered = credentials.filter((c) => c.consumerId === consumerId);
    const total = filtered.length;

    return c.json(
      listResponse(filtered.map(toCredentialResponse), {
        limit,
        offset,
        total,
        hasMore: offset + limit < total,
      }),
    );
  });

  // Create credential
  routes.post(
    "/consumers/:consumerId/credentials",
    zodValidator("json", createCredentialSchema),
    async (c) => {
      const { consumerId } = c.req.param();
      const body = c.req.valid("json");

      // Verify consumer exists
      const consumer = await consumerRepo.findById(consumerId);
      if (!consumer) {
        throw ApiError.notFound("Consumer");
      }

      await validateCredentialPayload(credentialRepo, {
        credentialType: body.credentialType,
        credential: body.credential,
      });

      const credential = await credentialRepo.create({
        consumerId,
        credentialType: body.credentialType,
        credential: body.credential,
        tags: body.tags ?? [],
      });

      return c.json(successResponse(toCredentialResponse(credential)), 201);
    },
  );

  // Get credential
  routes.get("/consumers/:consumerId/credentials/:credentialId", async (c) => {
    const { credentialId } = c.req.param();
    const credential = await credentialRepo.findById(credentialId);

    if (!credential) {
      throw ApiError.notFound("Credential");
    }

    return c.json(successResponse(toCredentialResponse(credential)));
  });

  // Update credential
  routes.put(
    "/consumers/:consumerId/credentials/:credentialId",
    zodValidator("json", updateCredentialSchema),
    async (c) => {
      const { credentialId } = c.req.param();
      const body = c.req.valid("json");

      const credential = await credentialRepo.findById(credentialId);
      if (!credential) {
        throw ApiError.notFound("Credential");
      }

      const resolvedCredentialType = body.credentialType ?? credential.credentialType;
      const resolvedCredential =
        body.credential ?? (credential.credential as Record<string, unknown>);
      await validateCredentialPayload(credentialRepo, {
        credentialType: resolvedCredentialType,
        credential: resolvedCredential,
        currentCredentialId: credential.id,
      });

      const updated = await credentialRepo.update(credentialId, {
        credentialType: resolvedCredentialType,
        credential: resolvedCredential,
        tags: body.tags ?? (credential.tags as string[]),
      });

      return c.json(successResponse(toCredentialResponse(updated)));
    },
  );

  // Delete credential
  routes.delete("/consumers/:consumerId/credentials/:credentialId", async (c) => {
    const { credentialId } = c.req.param();

    const credential = await credentialRepo.findById(credentialId);
    if (!credential) {
      throw ApiError.notFound("Credential");
    }

    await credentialRepo.delete(credentialId);
    return c.json(successResponse({ deleted: true }), 200);
  });

  return routes;
}

async function validateCredentialPayload(
  credentialRepo: CredentialRepository,
  input: {
    credentialType: string;
    credential: Record<string, unknown>;
    currentCredentialId?: string;
  },
): Promise<void> {
  if (input.credentialType !== "key-auth") {
    return;
  }

  const key = input.credential.key;
  if (typeof key !== "string" || key.trim().length === 0) {
    throw ApiError.badRequest("Key-auth credentials require a non-empty credential.key");
  }

  const existingCredential = await credentialRepo.findKeyAuthByKey(key);
  if (existingCredential && existingCredential.id !== input.currentCredentialId) {
    throw ApiError.conflict("Key-auth credential key already exists");
  }
}
