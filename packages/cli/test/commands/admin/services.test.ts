// Services command tests

import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { createServicesCommand } from "../../../src/commands/admin/services.js";
import { HttpClient } from "../../../src/lib/http-client.js";

// Mock HttpClient
vi.mock("../../../src/lib/http-client.js");

describe("admin services", () => {
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

  function createTestCommand(): ReturnType<typeof createServicesCommand> {
    const cmd = createServicesCommand();
    cmd.exitOverride(() => {});
    cmd.configureOutput({
      writeErr: () => {},
    });
    return cmd;
  }

  describe("list", () => {
    it("should list services with default pagination", async () => {
      mockGet.mockResolvedValue({ data: [] });

      const command = createTestCommand();
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      await command.parseAsync(["node", "services", "list"]);

      console.log = originalLog;

      expect(mockGet).toHaveBeenCalledWith("/services?limit=20&offset=0");
      expect(logs.length).toBeGreaterThan(0);
    });

    it("should list services with custom pagination", async () => {
      mockGet.mockResolvedValue({ data: [] });

      const command = createTestCommand();
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      await command.parseAsync(["node", "services", "list", "-l", "50", "-o", "100"]);

      console.log = originalLog;

      expect(mockGet).toHaveBeenCalledWith("/services?limit=50&offset=100");
    });

    it("should list services with name filter", async () => {
      mockGet.mockResolvedValue({ data: [] });

      const command = createTestCommand();
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      await command.parseAsync(["node", "services", "list", "-n", "api"]);

      console.log = originalLog;

      expect(mockGet).toHaveBeenCalledWith("/services?limit=20&offset=0&name=api");
    });
  });

  describe("get", () => {
    it("should get a service by ID", async () => {
      mockGet.mockResolvedValue({ data: { id: "svc-1", name: "Test Service" } });

      const command = createTestCommand();
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      await command.parseAsync(["node", "services", "get", "svc-1"]);

      console.log = originalLog;

      expect(mockGet).toHaveBeenCalledWith("/services/svc-1");
      expect(logs.length).toBeGreaterThan(0);
    });
  });

  describe("create", () => {
    it("should create a service with required fields", async () => {
      mockPost.mockResolvedValue({ data: { id: "svc-1", name: "New Service" } });

      const command = createTestCommand();
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      await command.parseAsync([
        "node",
        "services",
        "create",
        "-n",
        "New Service",
        "-u",
        "http://example.com",
      ]);

      console.log = originalLog;

      expect(mockPost).toHaveBeenCalledWith("/services", {
        name: "New Service",
        url: "http://example.com",
      });
    });

    it("should create a service with all options", async () => {
      mockPost.mockResolvedValue({ data: { id: "svc-1" } });

      const command = createTestCommand();
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      await command.parseAsync([
        "node",
        "services",
        "create",
        "-n",
        "Full Service",
        "-u",
        "http://example.com",
        "-p",
        "https",
        "-H",
        "example.com",
        "-P",
        "443",
        "--path",
        "/api",
        "--connect-timeout",
        "5000",
        "--write-timeout",
        "10000",
        "--read-timeout",
        "30000",
        "--retries",
        "3",
        "-t",
        "prod,api",
      ]);

      console.log = originalLog;

      expect(mockPost).toHaveBeenCalledWith("/services", {
        name: "Full Service",
        url: "http://example.com",
        protocol: "https",
        host: "example.com",
        port: 443,
        path: "/api",
        connectTimeout: 5000,
        writeTimeout: 10000,
        readTimeout: 30000,
        retries: 3,
        tags: ["prod", "api"],
      });
    });
  });

  describe("update", () => {
    it("should update a service with provided fields", async () => {
      mockPut.mockResolvedValue({ data: { id: "svc-1", name: "Updated" } });

      const command = createTestCommand();
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      await command.parseAsync([
        "node",
        "services",
        "update",
        "-n",
        "svc-1",
        "-u",
        "http://new.com",
      ]);

      console.log = originalLog;

      expect(mockPut).toHaveBeenCalledWith("/services/svc-1", {
        url: "http://new.com",
      });
    });
  });

  describe("delete", () => {
    it("should delete a service", async () => {
      mockDelete.mockResolvedValue({ data: { deleted: true } });

      const command = createTestCommand();
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      await command.parseAsync(["node", "services", "delete", "-n", "svc-1"]);

      console.log = originalLog;

      expect(mockDelete).toHaveBeenCalledWith("/services/svc-1");
    });
  });
});
