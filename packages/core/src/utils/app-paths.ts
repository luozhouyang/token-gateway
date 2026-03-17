// App Paths - Unified configuration and database path management

import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import { homedir } from "os";

/**
 * Get the user's default config directory path based on the operating system.
 *
 * Platform-specific paths:
 * - Linux: ~/.config/token-gateway
 * - macOS: ~/Library/Application Support/token-gateway
 * - Windows: ~\AppData\Roaming\token-gateway
 */
export function getConfigDir(): string {
  const home = homedir();
  const platform = process.platform;

  let configDir: string;

  if (platform === "win32") {
    // Windows: ~\AppData\Roaming\token-gateway
    configDir = join(process.env.APPDATA || home, "token-gateway");
  } else if (platform === "darwin") {
    // macOS: ~/Library/Application Support/token-gateway
    configDir = join(home, "Library", "Application Support", "token-gateway");
  } else {
    // Linux and others: ~/.config/token-gateway
    configDir = join(home, ".config", "token-gateway");
  }

  // Ensure directory exists
  ensureDirExists(configDir);

  return configDir;
}

/**
 * Get the default configuration file path.
 * @returns The full path to the configuration file
 */
export function getConfigPath(): string {
  return join(getConfigDir(), "config.yaml");
}

/**
 * Get the default database file path.
 * @returns The full path to the database file
 */
export function getDatabasePath(): string {
  return join(getConfigDir(), "token-gateway.db");
}

/**
 * Ensure a directory exists, creating it if necessary.
 */
function ensureDirExists(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Get the CLI config file path (for admin API authentication).
 * @returns The full path to the CLI config file
 */
export function getCliConfigPath(): string {
  return join(getConfigDir(), "cli-config.json");
}
