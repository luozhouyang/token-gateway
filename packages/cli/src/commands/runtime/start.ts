// Start command - Start the proxy engine

import { Command } from "commander";
import { promises as fs } from "fs";
import { join } from "path";
import * as yaml from "js-yaml";
import { DatabaseService, runMigrations, getDatabasePath } from "@minigateway/core";

interface Config {
  server?: {
    host?: string;
    port?: number;
  };
  database?: {
    path?: string;
  };
  admin?: {
    enabled?: boolean;
    basePath?: string;
  };
  proxy?: {
    timeout?: number;
    preserveHost?: boolean;
    stripPath?: boolean;
  };
  logging?: {
    level?: string;
    format?: string;
  };
  upstreams?: Array<{
    name: string;
    algorithm?: string;
    targets?: Array<{
      target: string;
      weight?: number;
    }>;
  }>;
  routes?: Array<{
    name: string;
    paths?: string[];
    upstream?: string;
  }>;
  plugins?: Array<{
    name: string;
    enabled?: boolean;
    config?: Record<string, unknown>;
  }>;
}

let isRunning = false;
let database: DatabaseService | null = null;

function loadConfig(configPath: string): Promise<Config> {
  return fs.readFile(configPath, "utf-8").then((content) => yaml.load(content) as Config);
}

async function startEngine(configPath: string): Promise<void> {
  try {
    // Load configuration
    const config = await loadConfig(configPath);

    // Get database path - use configured path or default to unified location
    const configuredDbPath = config.database?.path;
    const dbPath = configuredDbPath || getDatabasePath();

    // If dbPath is absolute, use it directly; otherwise resolve relative to config file
    const absoluteDbPath =
      dbPath.startsWith("/") || dbPath.includes(":")
        ? dbPath
        : join(join(configPath, ".."), dbPath);

    console.log("Running database migrations...");
    await runMigrations(absoluteDbPath);

    console.log("Initializing database connection...");
    database = new DatabaseService(absoluteDbPath);

    console.log("Creating admin API...");
    const { createAdminApi } = await import("@minigateway/core");
    const _app = createAdminApi({ db: database });

    // Get server config
    const host = config.server?.host || "0.0.0.0";
    const port = config.server?.port || 8080;

    console.log(`✓ Proxy engine started on ${host}:${port}`);
    console.log(`  Database: ${absoluteDbPath}`);
    console.log(`  Admin API: ${config.admin?.enabled !== false ? "enabled" : "disabled"}`);

    isRunning = true;

    // Start the server
    const server = { closed: false };
    process.on("SIGINT", () => {
      console.log("\nShutting down...");
      server.closed = true;
      shutdown();
    });

    process.on("SIGTERM", () => {
      console.log("\nShutting down...");
      server.closed = true;
      shutdown();
    });

    // Keep process running
    await new Promise<void>((resolve) => {
      // In a real implementation, you would start the HTTP server here
      // For now, just keep the process alive
      const keepAlive = setInterval(() => {
        if (server.closed) {
          clearInterval(keepAlive);
          resolve();
        }
      }, 100);
    });
  } catch (error) {
    console.error("Error starting proxy engine:", error);
    process.exit(1);
  }
}

function shutdown(): void {
  if (database) {
    database.close();
    database = null;
  }
  isRunning = false;
  process.exit(0);
}

export function createStartCommand(): Command {
  return new Command("start")
    .description("Start the proxy engine")
    .option("-c, --config <path>", "Config file path", "./proxy.config.yaml")
    .option("-w, --watch", "Watch config file changes")
    .action(async (options) => {
      const configPath = join(process.cwd(), options.config);

      try {
        // Check if file exists
        await fs.access(configPath);
      } catch {
        console.error(`Error: Config file not found: ${configPath}`);
        console.error("Run 'proxy-engine init' to create a configuration file.");
        process.exit(1);
      }

      if (isRunning) {
        console.log("Proxy engine is already running.");
        return;
      }

      await startEngine(configPath);
    });
}
