// Plugins command tests

import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { createPluginsCommand } from "../../../src/commands/admin/plugins.js";
import { HttpClient } from "../../../src/lib/http-client.js";

// Mock HttpClient
vi.mock("../../../src/lib/http-client.js");

describe("admin plugins", () => {
  const mockGet = vi.fn();
  const mockPost = vi.fn();
  const mockPut = vi.fn();
  const mockDelete = vi.fn();

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-unbound-method
    vi.mocked(HttpClient.create).mockResolvedValue({
      get: mockGet,
      post: mockPost,
      put: mockPut,
      delete: mockDelete,
    } as unknown as HttpClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function createTestCommand(): ReturnType<typeof createPluginsCommand> {
    const cmd = createPluginsCommand();
    cmd.exitOverride(() => {});
    cmd.configureOutput({
      writeErr: () => {},
    });
    return cmd;
  }

  describe("list", () => {
    it("should list plugins with default pagination", async () => {
      mockGet.mockResolvedValue({ data: [] });

      const command = createTestCommand();
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      await command.parseAsync(["node", "plugins", "list"]);

      console.log = originalLog;

      expect(mockGet).toHaveBeenCalledWith("/plugins?limit=20&offset=0");
      expect(logs.length).toBeGreaterThan(0);
    });

    it("should list plugins with custom pagination", async () => {
      mockGet.mockResolvedValue({ data: [] });

      const command = createTestCommand();
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      await command.parseAsync(["node", "plugins", "list", "-l", "50", "-o", "100"]);

      console.log = originalLog;

      expect(mockGet).toHaveBeenCalledWith("/plugins?limit=50&offset=100");
    });

    it("should list plugins with name filter", async () => {
      mockGet.mockResolvedValue({ data: [] });

      const command = createTestCommand();
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      await command.parseAsync(["node", "plugins", "list", "-n", "rate-limiting"]);

      console.log = originalLog;

      expect(mockGet).toHaveBeenCalledWith("/plugins?limit=20&offset=0&name=rate-limiting");
    });
  });

  describe("get", () => {
    it("should get a plugin by ID", async () => {
      mockGet.mockResolvedValue({ data: { id: "plg-1", name: "rate-limiting" } });

      const command = createTestCommand();
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      await command.parseAsync(["node", "plugins", "get", "plg-1"]);

      console.log = originalLog;

      expect(mockGet).toHaveBeenCalledWith("/plugins/plg-1");
      expect(logs.length).toBeGreaterThan(0);
    });
  });

  describe("create", () => {
    it("should create a plugin with required fields", async () => {
      mockPost.mockResolvedValue({ data: { id: "plg-1", name: "cors" } });

      const command = createTestCommand();
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      await command.parseAsync(["node", "plugins", "create", "-n", "cors"]);

      console.log = originalLog;

      expect(mockPost).toHaveBeenCalledWith("/plugins", {
        name: "cors",
        enabled: true,
      });
    });

    it("should create a plugin with service binding", async () => {
      mockPost.mockResolvedValue({ data: { id: "plg-1" } });

      const command = createTestCommand();
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      await command.parseAsync([
        "node",
        "plugins",
        "create",
        "-n",
        "rate-limiting",
        "-s",
        "svc-123",
      ]);

      console.log = originalLog;

      expect(mockPost).toHaveBeenCalledWith("/plugins", {
        name: "rate-limiting",
        enabled: true,
        serviceId: "svc-123",
      });
    });

    it("should create a plugin with all options", async () => {
      mockPost.mockResolvedValue({ data: { id: "plg-1" } });

      const command = createTestCommand();
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      await command.parseAsync([
        "node",
        "plugins",
        "create",
        "-n",
        "key-auth",
        "-s",
        "svc-123",
        "-r",
        "rt-456",
        "-c",
        "cons-789",
        "--config",
        '{"keyNames": ["X-API-Key"], "hideCredentials": true}',
        "--enabled",
        "false",
        "-t",
        "prod,auth",
      ]);

      console.log = originalLog;

      expect(mockPost).toHaveBeenCalledWith("/plugins", {
        name: "key-auth",
        enabled: false,
        serviceId: "svc-123",
        routeId: "rt-456",
        consumerId: "cons-789",
        config: { keyNames: ["X-API-Key"], hideCredentials: true },
        tags: ["prod", "auth"],
      });
    });

    it("should reject invalid JSON config", async () => {
      const command = createTestCommand();
      // eslint-disable-next-line @typescript-eslint/no-unbound-method
      const originalExit = process.exit;
      const mockExit = vi.fn((() => {}) as any);
      const mockError = vi.fn();
      process.exit = mockExit as any;
      console.error = mockError;

      await command.parseAsync([
        "node",
        "plugins",
        "create",
        "-n",
        "cors",
        "--config",
        "invalid-json",
      ]);

      process.exit = originalExit;

      expect(mockError).toHaveBeenCalledWith("Invalid JSON for config");
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  describe("update", () => {
    it("should update a plugin with provided fields", async () => {
      mockPut.mockResolvedValue({ data: { id: "plg-1", enabled: false } });

      const command = createTestCommand();
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      await command.parseAsync(["node", "plugins", "update", "-n", "plg-1", "--enabled", "false"]);

      console.log = originalLog;

      expect(mockPut).toHaveBeenCalledWith("/plugins/plg-1", {
        enabled: false,
      });
    });

    it("should update a plugin with config", async () => {
      mockPut.mockResolvedValue({ data: { id: "plg-1" } });

      const command = createTestCommand();
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      await command.parseAsync([
        "node",
        "plugins",
        "update",
        "-n",
        "plg-1",
        "-s",
        "svc-new",
        "--config",
        '{"updated": true}',
      ]);

      console.log = originalLog;

      expect(mockPut).toHaveBeenCalledWith("/plugins/plg-1", {
        serviceId: "svc-new",
        config: { updated: true },
      });
    });
  });

  describe("delete", () => {
    it("should delete a plugin", async () => {
      mockDelete.mockResolvedValue({ data: { deleted: true } });

      const command = createTestCommand();
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      await command.parseAsync(["node", "plugins", "delete", "-n", "plg-1"]);

      console.log = originalLog;

      expect(mockDelete).toHaveBeenCalledWith("/plugins/plg-1");
    });
  });
});
