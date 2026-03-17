// Routes command tests

import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { createRoutesCommand } from "../../../src/commands/admin/routes.js";
import { HttpClient } from "../../../src/lib/http-client.js";

// Mock HttpClient
vi.mock("../../../src/lib/http-client.js");

describe("admin routes", () => {
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

  function createTestCommand(): ReturnType<typeof createRoutesCommand> {
    const cmd = createRoutesCommand();
    cmd.exitOverride(() => {});
    cmd.configureOutput({
      writeErr: () => {},
    });
    return cmd;
  }

  describe("list", () => {
    it("should list routes with default pagination", async () => {
      mockGet.mockResolvedValue({ data: [] });

      const command = createTestCommand();
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      await command.parseAsync(["node", "routes", "list"]);

      console.log = originalLog;

      expect(mockGet).toHaveBeenCalledWith("/routes?limit=20&offset=0");
      expect(logs.length).toBeGreaterThan(0);
    });

    it("should list routes with custom pagination", async () => {
      mockGet.mockResolvedValue({ data: [] });

      const command = createTestCommand();
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      await command.parseAsync(["node", "routes", "list", "-l", "50", "-o", "100"]);

      console.log = originalLog;

      expect(mockGet).toHaveBeenCalledWith("/routes?limit=50&offset=100");
    });

    it("should list routes with service filter", async () => {
      mockGet.mockResolvedValue({ data: [] });

      const command = createTestCommand();
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      await command.parseAsync(["node", "routes", "list", "-s", "svc-123"]);

      console.log = originalLog;

      expect(mockGet).toHaveBeenCalledWith("/routes?limit=20&offset=0&serviceId=svc-123");
    });
  });

  describe("get", () => {
    it("should get a route by ID", async () => {
      mockGet.mockResolvedValue({ data: { id: "rt-1", name: "Test Route" } });

      const command = createTestCommand();
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      await command.parseAsync(["node", "routes", "get", "rt-1"]);

      console.log = originalLog;

      expect(mockGet).toHaveBeenCalledWith("/routes/rt-1");
      expect(logs.length).toBeGreaterThan(0);
    });
  });

  describe("create", () => {
    it("should create a route with required fields", async () => {
      mockPost.mockResolvedValue({ data: { id: "rt-1", name: "New Route" } });

      const command = createTestCommand();
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      await command.parseAsync(["node", "routes", "create", "-n", "New Route", "-s", "svc-123"]);

      console.log = originalLog;

      expect(mockPost).toHaveBeenCalledWith("/routes", {
        name: "New Route",
        serviceId: "svc-123",
        stripPath: true,
        preserveHost: false,
      });
    });

    it("should create a route with all options", async () => {
      mockPost.mockResolvedValue({ data: { id: "rt-1" } });

      const command = createTestCommand();
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      await command.parseAsync([
        "node",
        "routes",
        "create",
        "-n",
        "Full Route",
        "-s",
        "svc-123",
        "--protocols",
        "http",
        "--methods",
        "GET,POST",
        "--hosts",
        "example.com,api.example.com",
        "--paths",
        "/api,/v1",
        "--strip-path",
        "true",
        "--preserve-host",
        "false",
        "-t",
        "prod,api",
      ]);

      console.log = originalLog;

      expect(mockPost).toHaveBeenCalledWith("/routes", {
        name: "Full Route",
        serviceId: "svc-123",
        protocols: ["http"],
        methods: ["GET", "POST"],
        hosts: ["example.com", "api.example.com"],
        paths: ["/api", "/v1"],
        stripPath: true,
        preserveHost: false,
        tags: ["prod", "api"],
      });
    });
  });

  describe("update", () => {
    it("should update a route with provided fields", async () => {
      mockPut.mockResolvedValue({ data: { id: "rt-1", name: "Updated" } });

      const command = createTestCommand();
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      await command.parseAsync(["node", "routes", "update", "-n", "rt-1", "--protocols", "https"]);

      console.log = originalLog;

      expect(mockPut).toHaveBeenCalledWith("/routes/rt-1", {
        protocols: ["https"],
      });
    });
  });

  describe("delete", () => {
    it("should delete a route", async () => {
      mockDelete.mockResolvedValue({ data: { deleted: true } });

      const command = createTestCommand();
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      await command.parseAsync(["node", "routes", "delete", "-n", "rt-1"]);

      console.log = originalLog;

      expect(mockDelete).toHaveBeenCalledWith("/routes/rt-1");
    });
  });
});
