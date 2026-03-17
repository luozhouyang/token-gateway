// Targets command tests

import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { createTargetsCommand } from "../../../src/commands/admin/targets.js";
import { HttpClient } from "../../../src/lib/http-client.js";

// Mock HttpClient
vi.mock("../../../src/lib/http-client.js");

describe("admin targets", () => {
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

  function createTestCommand(): ReturnType<typeof createTargetsCommand> {
    const cmd = createTargetsCommand();
    cmd.exitOverride(() => {});
    cmd.configureOutput({
      writeErr: () => {},
    });
    return cmd;
  }

  describe("list", () => {
    it("should list targets with default pagination", async () => {
      mockGet.mockResolvedValue({ data: [] });

      const command = createTestCommand();
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      await command.parseAsync(["node", "targets", "list", "-u", "up-123"]);

      console.log = originalLog;

      expect(mockGet).toHaveBeenCalledWith("/upstreams/up-123/targets?limit=20&offset=0");
      expect(logs.length).toBeGreaterThan(0);
    });

    it("should list targets with custom pagination", async () => {
      mockGet.mockResolvedValue({ data: [] });

      const command = createTestCommand();
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      await command.parseAsync([
        "node",
        "targets",
        "list",
        "-u",
        "up-123",
        "-l",
        "50",
        "-o",
        "100",
      ]);

      console.log = originalLog;

      expect(mockGet).toHaveBeenCalledWith("/upstreams/up-123/targets?limit=50&offset=100");
    });
  });

  describe("create", () => {
    it("should create a target with required fields", async () => {
      mockPost.mockResolvedValue({ data: { id: "tgt-1", target: "192.168.1.1:8080" } });

      const command = createTestCommand();
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      await command.parseAsync([
        "node",
        "targets",
        "create",
        "-u",
        "up-123",
        "-t",
        "192.168.1.1:8080",
      ]);

      console.log = originalLog;

      expect(mockPost).toHaveBeenCalledWith("/upstreams/up-123/targets", {
        target: "192.168.1.1:8080",
        weight: 100,
      });
    });

    it("should create a target with custom weight", async () => {
      mockPost.mockResolvedValue({ data: { id: "tgt-1" } });

      const command = createTestCommand();
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      await command.parseAsync([
        "node",
        "targets",
        "create",
        "-u",
        "up-123",
        "-t",
        "192.168.1.1:8080",
        "-w",
        "50",
      ]);

      console.log = originalLog;

      expect(mockPost).toHaveBeenCalledWith("/upstreams/up-123/targets", {
        target: "192.168.1.1:8080",
        weight: 50,
      });
    });
  });

  describe("update", () => {
    it("should update a target with provided fields", async () => {
      mockPut.mockResolvedValue({ data: { id: "tgt-1", weight: 75 } });

      const command = createTestCommand();
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      await command.parseAsync([
        "node",
        "targets",
        "update",
        "-u",
        "up-123",
        "-t",
        "tgt-1",
        "-w",
        "75",
      ]);

      console.log = originalLog;

      expect(mockPut).toHaveBeenCalledWith("/upstreams/up-123/targets/tgt-1", {
        weight: 75,
      });
    });
  });

  describe("delete", () => {
    it("should delete a target", async () => {
      mockDelete.mockResolvedValue({ data: { deleted: true } });

      const command = createTestCommand();
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      await command.parseAsync(["node", "targets", "delete", "-u", "up-123", "-t", "tgt-1"]);

      console.log = originalLog;

      expect(mockDelete).toHaveBeenCalledWith("/upstreams/up-123/targets/tgt-1");
    });
  });
});
