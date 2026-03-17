// Upstreams command tests

import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { createUpstreamsCommand } from "../../../src/commands/admin/upstreams.js";
import { HttpClient } from "../../../src/lib/http-client.js";

// Mock HttpClient
vi.mock("../../../src/lib/http-client.js");

describe("admin upstreams", () => {
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

  function createTestCommand(): ReturnType<typeof createUpstreamsCommand> {
    const cmd = createUpstreamsCommand();
    cmd.exitOverride(() => {});
    cmd.configureOutput({
      writeErr: () => {},
    });
    return cmd;
  }

  describe("list", () => {
    it("should list upstreams with default pagination", async () => {
      mockGet.mockResolvedValue({ data: [] });

      const command = createTestCommand();
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      await command.parseAsync(["node", "upstreams", "list"]);

      console.log = originalLog;

      expect(mockGet).toHaveBeenCalledWith("/upstreams?limit=20&offset=0");
      expect(logs.length).toBeGreaterThan(0);
    });

    it("should list upstreams with custom pagination", async () => {
      mockGet.mockResolvedValue({ data: [] });

      const command = createTestCommand();
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      await command.parseAsync(["node", "upstreams", "list", "-l", "50", "-o", "100"]);

      console.log = originalLog;

      expect(mockGet).toHaveBeenCalledWith("/upstreams?limit=50&offset=100");
    });
  });

  describe("get", () => {
    it("should get an upstream by ID", async () => {
      mockGet.mockResolvedValue({ data: { id: "up-1", name: "Test Upstream" } });

      const command = createTestCommand();
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      await command.parseAsync(["node", "upstreams", "get", "up-1"]);

      console.log = originalLog;

      expect(mockGet).toHaveBeenCalledWith("/upstreams/up-1");
      expect(logs.length).toBeGreaterThan(0);
    });
  });

  describe("create", () => {
    it("should create an upstream with required fields", async () => {
      mockPost.mockResolvedValue({ data: { id: "up-1", name: "New Upstream" } });

      const command = createTestCommand();
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      await command.parseAsync(["node", "upstreams", "create", "-n", "New Upstream"]);

      console.log = originalLog;

      expect(mockPost).toHaveBeenCalledWith("/upstreams", {
        name: "New Upstream",
        algorithm: "round-robin",
        slots: 10000,
      });
    });

    it("should create an upstream with all options", async () => {
      mockPost.mockResolvedValue({ data: { id: "up-1" } });

      const command = createTestCommand();
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      await command.parseAsync([
        "node",
        "upstreams",
        "create",
        "-n",
        "Full Upstream",
        "-a",
        "round-robin",
        "--hash-on",
        "header",
        "--slots",
        "1024",
        "-t",
        "prod,backend",
      ]);

      console.log = originalLog;

      expect(mockPost).toHaveBeenCalledWith("/upstreams", {
        name: "Full Upstream",
        algorithm: "round-robin",
        hashOn: "header",
        slots: 1024,
        tags: ["prod", "backend"],
      });
    });
  });

  describe("update", () => {
    it("should update an upstream with provided fields", async () => {
      mockPut.mockResolvedValue({ data: { id: "up-1", name: "Updated" } });

      const command = createTestCommand();
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      await command.parseAsync([
        "node",
        "upstreams",
        "update",
        "-n",
        "up-1",
        "-a",
        "least-connections",
      ]);

      console.log = originalLog;

      expect(mockPut).toHaveBeenCalledWith("/upstreams/up-1", {
        algorithm: "least-connections",
      });
    });
  });

  describe("delete", () => {
    it("should delete an upstream", async () => {
      mockDelete.mockResolvedValue({ data: { deleted: true } });

      const command = createTestCommand();
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      await command.parseAsync(["node", "upstreams", "delete", "-n", "up-1"]);

      console.log = originalLog;

      expect(mockDelete).toHaveBeenCalledWith("/upstreams/up-1");
    });
  });
});
