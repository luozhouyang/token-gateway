import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { ConsumerRepository } from "../../entities/consumer.js";
import { CredentialRepository } from "../../entities/credential.js";
import { DatabaseService } from "../../storage/database.js";
import { runMigrations } from "../../storage/migrations.js";
import { createPluginStorageContext } from "../storage-context.js";
import { createPluginTestContext } from "../test-context.js";
import { KeyAuthPlugin } from "./key-auth.js";

describe("KeyAuthPlugin", () => {
  let tempDir: string;
  let dbPath: string;
  let db: DatabaseService;
  let consumerRepo: ConsumerRepository;
  let credentialRepo: CredentialRepository;
  let pluginStorage: unknown;

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "key-auth-plugin-test-"));
    dbPath = join(tempDir, "test.db");
    runMigrations(dbPath);
    db = new DatabaseService(dbPath);
    consumerRepo = new ConsumerRepository(db);
    credentialRepo = new CredentialRepository(db);
    pluginStorage = createStorage(db);

    const consumer = await consumerRepo.create({
      username: "auth-user",
      customId: "custom-auth-user",
    });

    await credentialRepo.create({
      consumerId: consumer.id,
      credentialType: "key-auth",
      credential: { key: "secret-key" },
      tags: [],
    });
  });

  afterEach(() => {
    db.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("has Kong-like metadata", () => {
    expect(KeyAuthPlugin.name).toBe("key-auth");
    expect(KeyAuthPlugin.priority).toBe(1250);
    expect(KeyAuthPlugin.phases).toEqual(["access"]);
  });

  test("returns 401 when credentials are missing", async () => {
    const ctx = createPluginTestContext({
      pluginStorage,
    });

    const result = await KeyAuthPlugin.onAccess?.(ctx);

    expect(result?.stop).toBe(true);
    expect(result?.response?.status).toBe(401);
  });

  test("authenticates with database credentials and strips upstream credentials", async () => {
    const ctx = createPluginTestContext({
      pluginStorage,
      clientRequest: {
        method: "GET",
        url: new URL("http://gateway.test/source"),
        headers: new Headers({ "x-api-key": "secret-key" }),
        body: null,
      },
      request: createPluginTestContext({
        clientRequest: {
          method: "GET",
          url: new URL("http://upstream.test/resource"),
          headers: new Headers({ "x-api-key": "secret-key" }),
          body: null,
        },
      }).request,
      config: {
        key_names: ["x-api-key"],
        hide_credentials: true,
      },
    });

    const result = await KeyAuthPlugin.onAccess?.(ctx);

    expect(result).toBeUndefined();
    expect(ctx.shared.get("authenticated")).toBe(true);
    expect(ctx.consumer?.username).toBe("auth-user");
    expect(ctx.request.headers.has("x-api-key")).toBe(false);
    expect(ctx.request.headers.get("x-consumer-id")).toBe(ctx.consumer?.id);
    expect(ctx.request.headers.get("x-consumer-username")).toBe("auth-user");
    expect(ctx.request.headers.get("x-consumer-custom-id")).toBe("custom-auth-user");
    expect(ctx.request.headers.get("x-credential-identifier")).toBe("secret-key");
  });

  test("returns 401 when the API key does not exist in the database", async () => {
    const ctx = createPluginTestContext({
      pluginStorage,
      clientRequest: {
        method: "GET",
        url: new URL("http://gateway.test/source?apikey=unknown-key"),
        headers: new Headers(),
        body: null,
      },
      config: {
        key_names: ["apikey"],
      },
    });

    const result = await KeyAuthPlugin.onAccess?.(ctx);

    expect(result?.stop).toBe(true);
    expect(result?.response?.status).toBe(401);
  });
});

function createStorage(db: DatabaseService): unknown {
  return KeyAuthPlugin.createStorage?.(
    createPluginStorageContext(db.getRawDatabase(), KeyAuthPlugin),
  );
}
