// Consumers command tests

import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { createConsumersCommand } from "../../../src/commands/admin/consumers.js";
import { HttpClient } from "../../../src/lib/http-client.js";

// Mock HttpClient
vi.mock("../../../src/lib/http-client.js");

describe("admin consumers", () => {
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

  function createTestCommand(): ReturnType<typeof createConsumersCommand> {
    const cmd = createConsumersCommand();
    cmd.exitOverride(() => {});
    cmd.configureOutput({
      writeErr: () => {},
    });
    return cmd;
  }

  describe("list", () => {
    it("should list consumers with default pagination", async () => {
      mockGet.mockResolvedValue({ data: [] });

      const command = createTestCommand();
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      await command.parseAsync(["node", "consumers", "list"]);

      console.log = originalLog;

      expect(mockGet).toHaveBeenCalledWith("/consumers?limit=20&offset=0");
      expect(logs.length).toBeGreaterThan(0);
    });

    it("should list consumers with custom pagination", async () => {
      mockGet.mockResolvedValue({ data: [] });

      const command = createTestCommand();
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      await command.parseAsync(["node", "consumers", "list", "-l", "50", "-o", "100"]);

      console.log = originalLog;

      expect(mockGet).toHaveBeenCalledWith("/consumers?limit=50&offset=100");
    });

    it("should list consumers with username filter", async () => {
      mockGet.mockResolvedValue({ data: [] });

      const command = createTestCommand();
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      await command.parseAsync(["node", "consumers", "list", "-u", "john@example.com"]);

      console.log = originalLog;

      expect(mockGet).toHaveBeenCalledWith(
        "/consumers?limit=20&offset=0&username=john%40example.com",
      );
    });
  });

  describe("get", () => {
    it("should get a consumer by ID", async () => {
      mockGet.mockResolvedValue({ data: { id: "cons-1", username: "test-user" } });

      const command = createTestCommand();
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      await command.parseAsync(["node", "consumers", "get", "cons-1"]);

      console.log = originalLog;

      expect(mockGet).toHaveBeenCalledWith("/consumers/cons-1");
      expect(logs.length).toBeGreaterThan(0);
    });
  });

  describe("create", () => {
    it("should create a consumer with no fields", async () => {
      mockPost.mockResolvedValue({ data: { id: "cons-1" } });

      const command = createTestCommand();
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      await command.parseAsync(["node", "consumers", "create"]);

      console.log = originalLog;

      expect(mockPost).toHaveBeenCalledWith("/consumers", {});
    });

    it("should create a consumer with username", async () => {
      mockPost.mockResolvedValue({ data: { id: "cons-1", username: "new-user" } });

      const command = createTestCommand();
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      await command.parseAsync(["node", "consumers", "create", "-u", "new-user"]);

      console.log = originalLog;

      expect(mockPost).toHaveBeenCalledWith("/consumers", {
        username: "new-user",
      });
    });

    it("should create a consumer with all options", async () => {
      mockPost.mockResolvedValue({ data: { id: "cons-1" } });

      const command = createTestCommand();
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      await command.parseAsync([
        "node",
        "consumers",
        "create",
        "-u",
        "full-user",
        "-c",
        "custom-123",
        "-t",
        "premium,verified",
      ]);

      console.log = originalLog;

      expect(mockPost).toHaveBeenCalledWith("/consumers", {
        username: "full-user",
        customId: "custom-123",
        tags: ["premium", "verified"],
      });
    });
  });

  describe("update", () => {
    it("should update a consumer with provided fields", async () => {
      mockPut.mockResolvedValue({ data: { id: "cons-1", username: "updated" } });

      const command = createTestCommand();
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      await command.parseAsync(["node", "consumers", "update", "-n", "cons-1", "-u", "updated"]);

      console.log = originalLog;

      expect(mockPut).toHaveBeenCalledWith("/consumers/cons-1", {
        username: "updated",
      });
    });
  });

  describe("delete", () => {
    it("should delete a consumer", async () => {
      mockDelete.mockResolvedValue({ data: { deleted: true } });

      const command = createTestCommand();
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      await command.parseAsync(["node", "consumers", "delete", "-n", "cons-1"]);

      console.log = originalLog;

      expect(mockDelete).toHaveBeenCalledWith("/consumers/cons-1");
    });
  });
});
