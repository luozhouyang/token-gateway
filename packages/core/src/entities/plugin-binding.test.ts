import { test, expect, beforeEach, afterEach, describe } from "vite-plus/test";
import { DatabaseService } from "../storage/database.js";
import { PluginBindingRepository } from "./plugin-binding.js";
import { ServiceRepository } from "./service.js";
import { RouteRepository } from "./route.js";
import { ConsumerRepository } from "./consumer.js";
import { runMigrations } from "../storage/migrations.js";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

describe("PluginBindingRepository", () => {
  let tempDir: string;
  let dbPath: string;
  let db: DatabaseService;
  let pluginRepo: PluginBindingRepository;
  let serviceRepo: ServiceRepository;
  let routeRepo: RouteRepository;
  let consumerRepo: ConsumerRepository;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "plugin-binding-repo-test-"));
    dbPath = join(tempDir, "test.db");
    db = new DatabaseService(dbPath);
    pluginRepo = new PluginBindingRepository(db);
    serviceRepo = new ServiceRepository(db);
    routeRepo = new RouteRepository(db);
    consumerRepo = new ConsumerRepository(db);

    runMigrations(dbPath);
  });

  afterEach(() => {
    db.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("creates a plugin binding", async () => {
    const plugin = await pluginRepo.create({
      name: "rate-limiting",
      config: { second: 10 },
      enabled: true,
      tags: ["test"],
    });

    expect(plugin.name).toBe("rate-limiting");
    expect(plugin.config).toEqual({ second: 10 });
    expect(plugin.enabled).toBe(true);
    expect(plugin.id).toBeDefined();
  });

  test("creates a plugin binding bound to a service", async () => {
    const service = await serviceRepo.create({
      name: "test-service",
      url: "http://localhost:8080",
      protocol: "http",
      host: "localhost",
      port: 8080,
      connectTimeout: 60000,
      writeTimeout: 60000,
      readTimeout: 60000,
      retries: 5,
      tags: [] as string[],
    });

    const plugin = await pluginRepo.create({
      name: "rate-limiting",
      serviceId: service.id,
      config: { second: 10 },
      enabled: true,
      tags: [] as string[],
    });

    expect(plugin.serviceId).toBe(service.id);
  });

  test("finds plugin binding by id", async () => {
    const created = await pluginRepo.create({
      name: "test-plugin",
      config: { key: "value" },
      enabled: true,
      tags: [] as string[],
    });

    const found = await pluginRepo.findById(created.id);

    expect(found).toBeDefined();
    expect(found?.id).toBe(created.id);
    expect(found?.name).toBe("test-plugin");
  });

  test("finds plugin bindings by service id", async () => {
    const service = await serviceRepo.create({
      name: "test-service",
      url: "http://localhost:8080",
      protocol: "http",
      host: "localhost",
      port: 8080,
      connectTimeout: 60000,
      writeTimeout: 60000,
      readTimeout: 60000,
      retries: 5,
      tags: [] as string[],
    });

    await pluginRepo.create({
      name: "plugin-1",
      serviceId: service.id,
      config: {},
      enabled: true,
      tags: [] as string[],
    });
    await pluginRepo.create({
      name: "plugin-2",
      serviceId: service.id,
      config: {},
      enabled: true,
      tags: [] as string[],
    });
    await pluginRepo.create({
      name: "plugin-3",
      config: {},
      enabled: true,
      tags: [] as string[],
    });

    const plugins = await pluginRepo.findByServiceId(service.id);

    expect(plugins).toHaveLength(2);
    expect(plugins.every((p) => p.serviceId === service.id)).toBe(true);
  });

  test("finds plugin bindings by route id", async () => {
    const service = await serviceRepo.create({
      name: "test-service",
      url: "http://localhost:8080",
      protocol: "http",
      host: "localhost",
      port: 8080,
      connectTimeout: 60000,
      writeTimeout: 60000,
      readTimeout: 60000,
      retries: 5,
      tags: [] as string[],
    });

    const route = await routeRepo.create({
      name: "test-route",
      serviceId: service.id,
      protocols: ["http"],
      stripPath: false,
      preserveHost: false,
      regexPriority: 0,
      pathHandling: "v0",
      tags: [] as string[],
    });

    await pluginRepo.create({
      name: "plugin-1",
      routeId: route.id,
      config: {},
      enabled: true,
      tags: [] as string[],
    });
    await pluginRepo.create({
      name: "plugin-2",
      routeId: route.id,
      config: {},
      enabled: true,
      tags: [] as string[],
    });

    const plugins = await pluginRepo.findByRouteId(route.id);

    expect(plugins).toHaveLength(2);
    expect(plugins.every((p) => p.routeId === route.id)).toBe(true);
  });

  test("finds plugin bindings by consumer id", async () => {
    const consumer = await consumerRepo.create({
      username: "test-consumer",
      customId: "custom-123",
      tags: [] as string[],
    });

    await pluginRepo.create({
      name: "plugin-1",
      consumerId: consumer.id,
      config: {},
      enabled: true,
      tags: [] as string[],
    });
    await pluginRepo.create({
      name: "plugin-2",
      consumerId: consumer.id,
      config: {},
      enabled: true,
      tags: [] as string[],
    });

    const plugins = await pluginRepo.findByConsumerId(consumer.id);

    expect(plugins).toHaveLength(2);
    expect(plugins.every((p) => p.consumerId === consumer.id)).toBe(true);
  });

  test("updates a plugin binding", async () => {
    const created = await pluginRepo.create({
      name: "test-plugin",
      config: { key: "value" },
      enabled: true,
      tags: [] as string[],
    });

    const updated = await pluginRepo.update(created.id, {
      config: { key: "updated" },
      enabled: false,
      tags: ["updated"],
    });

    expect(updated.config).toEqual({ key: "updated" });
    expect(updated.enabled).toBe(false);
    expect(updated.tags).toContain("updated");
  });

  test("deletes a plugin binding", async () => {
    const created = await pluginRepo.create({
      name: "test-plugin",
      config: {},
      enabled: true,
      tags: [] as string[],
    });

    const deleted = await pluginRepo.delete(created.id);

    expect(deleted).toBe(true);
    expect(await pluginRepo.findById(created.id)).toBeNull();
  });
});
