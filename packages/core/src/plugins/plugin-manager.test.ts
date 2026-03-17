import { test, expect, beforeEach, afterEach, describe } from "vite-plus/test";
import { PluginManager } from "./plugin-manager.js";
import { PluginLoader } from "./plugin-loader.js";
import { DatabaseService } from "../storage/database.js";
import { runMigrations } from "../storage/migrations.js";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import type { PluginDefinition, PluginContext, PluginInstance } from "./types.js";
import { plugins } from "../storage/schema.js";

describe("PluginLoader", () => {
  let tempDir: string;
  let loader: PluginLoader;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "plugin-loader-test-"));
    loader = new PluginLoader();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("loads built-in plugin by name", async () => {
    const plugin = await loader.loadBuiltin("cors");
    expect(plugin).toBeDefined();
    expect(plugin.name).toBe("cors");
    expect(plugin.phases).toContain("request");
  });

  test("loads cors built-in plugin", async () => {
    const plugin = await loader.loadBuiltin("cors");
    expect(plugin).toBeDefined();
    expect(plugin.name).toBe("cors");
    expect(plugin.phases).toContain("response");
  });

  test("loads logger built-in plugin", async () => {
    const plugin = await loader.loadBuiltin("logger");
    expect(plugin).toBeDefined();
    expect(plugin.name).toBe("logger");
    expect(plugin.phases).toContain("request");
  });

  test("loads rate-limit built-in plugin", async () => {
    const plugin = await loader.loadBuiltin("rate-limit");
    expect(plugin).toBeDefined();
    expect(plugin.name).toBe("rate-limit");
    expect(plugin.phases).toContain("request");
  });

  test("loads key-auth built-in plugin", async () => {
    const plugin = await loader.loadBuiltin("key-auth");
    expect(plugin).toBeDefined();
    expect(plugin.name).toBe("key-auth");
    expect(plugin.phases).toContain("request");
  });

  test("throws error for unknown built-in plugin", async () => {
    await expect(loader.loadBuiltin("unknown-plugin")).rejects.toThrow(
      "Unknown built-in plugin: unknown-plugin",
    );
  });

  test("lists all built-in plugins", async () => {
    const builtins = loader.listBuiltins();
    expect(builtins).toContain("cors");
    expect(builtins).toContain("logger");
    expect(builtins).toContain("rate-limit");
    expect(builtins).toContain("key-auth");
  });
});

describe("PluginManager", () => {
  let tempDir: string;
  let dbPath: string;
  let db: DatabaseService;
  let manager: PluginManager;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "plugin-manager-test-"));
    dbPath = join(tempDir, "test.db");
    db = new DatabaseService(dbPath);
    manager = new PluginManager(db);
    runMigrations(dbPath);
  });

  afterEach(() => {
    db.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("creates plugin manager", () => {
    expect(manager).toBeDefined();
  });

  test("registers custom plugin", async () => {
    const mockPlugin: PluginDefinition = {
      name: "custom-plugin",
      version: "1.0.0",
      phases: ["request"],
      priority: 50,
      onRequest: () => {},
    };

    manager.registerPlugin(mockPlugin);

    // Plugin should be loadable
    const loaded = await (manager as any).loadPluginDef("custom-plugin");
    expect(loaded).toBeDefined();
    expect(loaded?.name).toBe("custom-plugin");
  });

  test("unregisters custom plugin", async () => {
    const mockPlugin: PluginDefinition = {
      name: "temp-plugin",
      version: "1.0.0",
      phases: ["request"],
      priority: 50,
      onRequest: () => {},
    };

    manager.registerPlugin(mockPlugin);
    manager.unregisterPlugin("temp-plugin");

    // Plugin should not be loadable
    const loaded = await (manager as any).loadPluginDef("temp-plugin");
    expect(loaded).toBeNull();
  });

  test("executes single plugin", async () => {
    let executed = false;

    const mockPlugin: PluginDefinition = {
      name: "test-plugin",
      version: "1.0.0",
      phases: ["request"],
      priority: 50,
      onRequest: () => {
        executed = true;
      },
    };

    manager.registerPlugin(mockPlugin);

    const mockInstance: PluginInstance = {
      id: "1",
      name: "test-plugin",
      config: {},
      enabled: true,
      tags: [],
      consumerId: null,
      routeId: null,
      serviceId: null,
      priority: 50,
    };

    const mockContext: PluginContext = {
      request: new Request("http://example.com"),
      url: new URL("http://example.com"),
      method: "GET",
      headers: new Headers(),
      plugin: mockInstance,
      config: {},
      state: new Map(),
      waitUntil: () => {},
    };

    await manager.executePlugin("request", mockInstance, mockContext);
    expect(executed).toBe(true);
  });

  test("executes plugins in priority order", async () => {
    const executionOrder: string[] = [];

    // Register in reverse order to test sorting
    manager.registerPlugin({
      name: "test-plugin",
      version: "1.0.0",
      phases: ["request"],
      priority: 10,
      onRequest: () => {
        executionOrder.push("test-plugin");
      },
    });

    manager.registerPlugin({
      name: "test-plugin-2",
      version: "1.0.0",
      phases: ["request"],
      priority: 20,
      onRequest: () => {
        executionOrder.push("test-plugin-2");
      },
    });

    // Use executeAllPluginInstances which properly sorts by priority
    const mockContext: PluginContext = {
      request: new Request("http://example.com"),
      url: new URL("http://example.com"),
      method: "GET",
      headers: new Headers(),
      plugin: {
        id: "1",
        name: "test-plugin",
        config: {},
        enabled: true,
        tags: [],
        consumerId: null,
        routeId: null,
        serviceId: null,
        priority: 10,
      },
      config: {},
      state: new Map(),
      waitUntil: () => {},
    };

    const pluginInstances: PluginInstance[] = [
      {
        id: "1",
        name: "test-plugin",
        config: {},
        enabled: true,
        priority: 10,
      },
      {
        id: "2",
        name: "test-plugin-2",
        config: {},
        enabled: true,
        priority: 20,
      },
    ];

    await manager.executeAllPluginInstances("request", pluginInstances, mockContext);

    // Higher priority runs first
    expect(executionOrder).toEqual(["test-plugin-2", "test-plugin"]);
  });

  test("stops execution when stop flag is set", async () => {
    const executionOrder: string[] = [];

    manager.registerPlugin({
      name: "stopper",
      version: "1.0.0",
      phases: ["request"],
      priority: 20,
      onRequest: () => ({ stop: true }),
    });

    manager.registerPlugin({
      name: "should-not-run",
      version: "1.0.0",
      phases: ["request"],
      priority: 10,
      onRequest: () => {
        executionOrder.push("should-not-run");
      },
    });

    const mockContext: PluginContext = {
      request: new Request("http://example.com"),
      url: new URL("http://example.com"),
      method: "GET",
      headers: new Headers(),
      plugin: {
        id: "1",
        name: "stopper",
        config: {},
        enabled: true,
        tags: [],
        consumerId: null,
        routeId: null,
        serviceId: null,
        priority: 20,
      },
      config: {},
      state: new Map(),
      waitUntil: () => {},
    };

    const pluginInstances: PluginInstance[] = [
      {
        id: "1",
        name: "stopper",
        config: {},
        enabled: true,
        priority: 20,
      },
      {
        id: "2",
        name: "should-not-run",
        config: {},
        enabled: true,
        priority: 10,
      },
    ];

    const result = await manager.executeAllPluginInstances("request", pluginInstances, mockContext);

    expect(result.stopped).toBe(true);
    expect(executionOrder).toHaveLength(0);
  });

  test("executeAllPluginInstances runs all plugins in order", async () => {
    const executionOrder: string[] = [];

    manager.registerPlugin({
      name: "cors",
      version: "1.0.0",
      phases: ["request"],
      priority: 100,
      onRequest: () => {
        executionOrder.push("cors");
      },
    });

    manager.registerPlugin({
      name: "logger",
      version: "1.0.0",
      phases: ["request"],
      priority: 90,
      onRequest: () => {
        executionOrder.push("logger");
      },
    });

    const mockContext: PluginContext = {
      request: new Request("http://example.com"),
      url: new URL("http://example.com"),
      method: "GET",
      headers: new Headers(),
      plugin: {
        id: "1",
        name: "cors",
        config: {},
        enabled: true,
        tags: [],
        consumerId: null,
        routeId: null,
        serviceId: null,
        priority: 100,
      },
      config: {},
      state: new Map(),
      waitUntil: () => {},
    };

    const pluginInstances: PluginInstance[] = [
      {
        id: "1",
        name: "cors",
        config: {},
        enabled: true,
        priority: 100,
      },
      {
        id: "2",
        name: "logger",
        config: {},
        enabled: true,
        priority: 90,
      },
    ];

    await manager.executeAllPluginInstances("request", pluginInstances, mockContext);

    expect(executionOrder).toEqual(["cors", "logger"]);
  });

  test("returns error when plugin throws", async () => {
    manager.registerPlugin({
      name: "error-plugin",
      version: "1.0.0",
      phases: ["request"],
      priority: 50,
      onRequest: () => {
        throw new Error("Plugin error");
      },
    });

    const mockContext: PluginContext = {
      request: new Request("http://example.com"),
      url: new URL("http://example.com"),
      method: "GET",
      headers: new Headers(),
      plugin: {
        id: "1",
        name: "error-plugin",
        config: {},
        enabled: true,
        tags: [],
        consumerId: null,
        routeId: null,
        serviceId: null,
        priority: 50,
      },
      config: {},
      state: new Map(),
      waitUntil: () => {},
    };

    const pluginInstance: PluginInstance = {
      id: "1",
      name: "error-plugin",
      config: {},
      enabled: true,
      priority: 50,
    };

    const result = await manager.executePlugin("request", pluginInstance, mockContext);

    expect(result.stopped).toBe(true);
    expect(result.error).toBeDefined();
    expect(result.error?.message).toBe("Plugin error");
  });
});

describe("PluginManager with database", () => {
  let tempDir: string;
  let dbPath: string;
  let db: DatabaseService;
  let manager: PluginManager;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "plugin-manager-db-test-"));
    dbPath = join(tempDir, "test.db");
    db = new DatabaseService(dbPath);
    manager = new PluginManager(db);
    runMigrations(dbPath);
  });

  afterEach(() => {
    db.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("reads global plugins from database", async () => {
    // Insert a plugin directly into database
    const dbClient = db.getDrizzleDb();
    dbClient
      .insert(plugins)
      .values({
        id: "plugin-1",
        name: "cors",
        config: { origin: "*" },
        enabled: true,
        tags: [],
      })
      .run();

    // Get global plugins
    const loadedPlugins = await manager.getGlobalPluginInstances();
    expect(loadedPlugins).toHaveLength(1);
    expect(loadedPlugins[0].name).toBe("cors");
  });

  test("filters disabled plugins", async () => {
    const dbClient = db.getDrizzleDb();

    // Insert enabled plugin
    dbClient
      .insert(plugins)
      .values({
        id: "plugin-1",
        name: "cors",
        config: {},
        enabled: true,
        tags: [],
      })
      .run();

    // Insert disabled plugin
    dbClient
      .insert(plugins)
      .values({
        id: "plugin-2",
        name: "logger",
        config: {},
        enabled: false,
        tags: [],
      })
      .run();

    const globalPlugins = await manager.getGlobalPluginInstances();
    expect(globalPlugins).toHaveLength(1);
    expect(globalPlugins[0].name).toBe("cors");
  });
});
