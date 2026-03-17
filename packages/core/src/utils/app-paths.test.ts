// App Paths Tests

import { describe, it, expect } from "vite-plus/test";
import { existsSync } from "node:fs";
import { getConfigDir, getConfigPath, getDatabasePath, getCliConfigPath } from "./app-paths.js";

describe("app-paths", () => {
  describe("getConfigDir", () => {
    it("should return a non-empty string", () => {
      const configDir = getConfigDir();
      expect(configDir).toBeTruthy();
      expect(typeof configDir).toBe("string");
    });

    it("should include token-gateway in the path", () => {
      const configDir = getConfigDir();
      expect(configDir).toContain("token-gateway");
    });

    it("should create directory that exists", () => {
      const configDir = getConfigDir();
      // getConfigDir should ensure directory exists
      expect(existsSync(configDir)).toBe(true);
    });
  });

  describe("getConfigPath", () => {
    it("should return config path in config dir", () => {
      const configPath = getConfigPath();
      expect(configPath).toBeTruthy();
      expect(configPath).toContain("token-gateway");
      expect(configPath).toMatch(/\.(yaml|yml)$/);
    });
  });

  describe("getDatabasePath", () => {
    it("should return database path in config dir", () => {
      const dbPath = getDatabasePath();
      expect(dbPath).toBeTruthy();
      expect(dbPath).toContain("token-gateway");
      expect(dbPath).toMatch(/\.db$/);
    });
  });

  describe("getCliConfigPath", () => {
    it("should return CLI config path in config dir", () => {
      const cliConfigPath = getCliConfigPath();
      expect(cliConfigPath).toBeTruthy();
      expect(cliConfigPath).toContain("token-gateway");
      expect(cliConfigPath).toMatch(/\.json$/);
    });
  });
});
