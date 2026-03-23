import { test, expect, beforeEach, afterEach, describe } from "vite-plus/test";
import { DatabaseService } from "../storage/database.js";
import { CredentialRepository } from "./credential.js";
import { ConsumerRepository } from "./consumer.js";
import { runMigrations } from "../storage/migrations.js";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

describe("CredentialRepository", () => {
  let tempDir: string;
  let dbPath: string;
  let db: DatabaseService;
  let credentialRepo: CredentialRepository;
  let consumerRepo: ConsumerRepository;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "credential-repo-test-"));
    dbPath = join(tempDir, "test.db");
    db = new DatabaseService(dbPath);
    credentialRepo = new CredentialRepository(db);
    consumerRepo = new ConsumerRepository(db);

    runMigrations(dbPath);
  });

  afterEach(() => {
    db.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("creates a credential", async () => {
    const consumer = await consumerRepo.create({
      username: "test-user",
      customId: "custom-123",
      tags: [] as string[],
    });

    const credential = await credentialRepo.create({
      consumerId: consumer.id,
      credentialType: "key-auth",
      credential: { key: "secret-key-123" },
      tags: ["test"],
    });

    expect(credential.consumerId).toBe(consumer.id);
    expect(credential.credentialType).toBe("key-auth");
    expect(credential.credential).toEqual({ key: "secret-key-123" });
    expect(credential.id).toBeDefined();
  });

  test("finds credential by id", async () => {
    const consumer = await consumerRepo.create({
      username: "test-user",
      customId: "custom-123",
      tags: [] as string[],
    });

    const created = await credentialRepo.create({
      consumerId: consumer.id,
      credentialType: "key-auth",
      credential: { key: "secret-key" },
      tags: [] as string[],
    });

    const found = await credentialRepo.findById(created.id);

    expect(found).toBeDefined();
    expect(found?.id).toBe(created.id);
    expect(found?.credentialType).toBe("key-auth");
  });

  test("finds credentials by consumer id", async () => {
    const consumer1 = await consumerRepo.create({
      username: "user-1",
      customId: "custom-1",
      tags: [] as string[],
    });

    const consumer2 = await consumerRepo.create({
      username: "user-2",
      customId: "custom-2",
      tags: [] as string[],
    });

    await credentialRepo.create({
      consumerId: consumer1.id,
      credentialType: "key-auth",
      credential: { key: "key-1" },
      tags: [] as string[],
    });
    await credentialRepo.create({
      consumerId: consumer1.id,
      credentialType: "jwt",
      credential: { secret: "jwt-secret" },
      tags: [] as string[],
    });
    await credentialRepo.create({
      consumerId: consumer2.id,
      credentialType: "key-auth",
      credential: { key: "key-2" },
      tags: [] as string[],
    });

    const credentials = await credentialRepo.findByConsumerId(consumer1.id);

    expect(credentials).toHaveLength(2);
    expect(credentials.every((c) => c.consumerId === consumer1.id)).toBe(true);
  });

  test("finds key-auth credentials by key", async () => {
    const consumer = await consumerRepo.create({
      username: "lookup-user",
      customId: "lookup-custom-id",
      tags: [] as string[],
    });

    await credentialRepo.create({
      consumerId: consumer.id,
      credentialType: "key-auth",
      credential: { key: "lookup-key" },
      tags: [] as string[],
    });

    await credentialRepo.create({
      consumerId: consumer.id,
      credentialType: "jwt",
      credential: { key: "lookup-key" },
      tags: [] as string[],
    });

    const credential = await credentialRepo.findKeyAuthByKey("lookup-key");

    expect(credential).toBeDefined();
    expect(credential?.credentialType).toBe("key-auth");
    expect(credential?.credential).toEqual({ key: "lookup-key" });
  });

  test("finds all credentials", async () => {
    const consumer = await consumerRepo.create({
      username: "test-user",
      customId: "custom-123",
      tags: [] as string[],
    });

    await credentialRepo.create({
      consumerId: consumer.id,
      credentialType: "key-auth",
      credential: { key: "key-1" },
      tags: [] as string[],
    });
    await credentialRepo.create({
      consumerId: consumer.id,
      credentialType: "jwt",
      credential: { secret: "jwt-secret" },
      tags: [] as string[],
    });

    const credentials = await credentialRepo.findAll();

    expect(credentials).toHaveLength(2);
  });

  test("updates a credential", async () => {
    const consumer = await consumerRepo.create({
      username: "test-user",
      customId: "custom-123",
      tags: [] as string[],
    });

    const created = await credentialRepo.create({
      consumerId: consumer.id,
      credentialType: "key-auth",
      credential: { key: "old-key" },
      tags: [] as string[],
    });

    const updated = await credentialRepo.update(created.id, {
      credential: { key: "new-key" },
      tags: ["updated"],
    });

    expect(updated.credential).toEqual({ key: "new-key" });
    expect(updated.tags).toContain("updated");
  });

  test("deletes a credential", async () => {
    const consumer = await consumerRepo.create({
      username: "test-user",
      customId: "custom-123",
      tags: [] as string[],
    });

    const created = await credentialRepo.create({
      consumerId: consumer.id,
      credentialType: "key-auth",
      credential: { key: "secret-key" },
      tags: [] as string[],
    });

    const deleted = await credentialRepo.delete(created.id);

    expect(deleted).toBe(true);
    expect(await credentialRepo.findById(created.id)).toBeNull();
  });
});
