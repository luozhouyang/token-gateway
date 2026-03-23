#!/usr/bin/env node
import { Command } from "commander";
import {
  DatabaseService,
  getDatabasePath,
  runMigrations,
  startUnifiedServer,
} from "@minigateway/core";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";

const program = new Command();

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function resolveUiDistPath(options: {
  uiEnabled: boolean;
  uiDist?: string;
}): Promise<string | undefined> {
  if (!options.uiEnabled) {
    return undefined;
  }

  const candidates = [
    options.uiDist ? path.resolve(options.uiDist) : undefined,
    process.env.TOKEN_GATEWAY_UI_DIST ? path.resolve(process.env.TOKEN_GATEWAY_UI_DIST) : undefined,
    fileURLToPath(new URL("./web/", import.meta.url)),
    path.resolve(process.cwd(), "apps/web/.output/public"),
    path.resolve(process.cwd(), "apps/web/dist"),
    path.resolve(process.cwd(), "apps/web/dist/client"),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    if ((await pathExists(candidate)) && (await pathExists(path.join(candidate, "index.html")))) {
      return candidate;
    }
  }

  return undefined;
}

program
  .name("token-gateway")
  .description("Token Gateway - LLM API Proxy with Web UI")
  .version("0.0.1");

program
  .command("start")
  .description("Start the unified server (Proxy + Web UI + Admin API)")
  .option("-p, --port <port>", "Server port", "8080")
  .option("--db <path>", "Database file path")
  .option("--ui-dist <path>", "Web UI dist directory path")
  .option("--no-ui", "Disable Web UI (Admin API only)")
  .action(async (options) => {
    let database: DatabaseService | undefined;
    const uiEnabled = options.ui !== false;

    try {
      // Determine database path
      const dbPath = path.resolve(options.db || getDatabasePath());

      // Ensure database directory exists
      const dbDir = path.dirname(dbPath);
      await fs.mkdir(dbDir, { recursive: true });

      runMigrations(dbPath);
      database = new DatabaseService(dbPath);

      const uiDistPath = await resolveUiDistPath({
        uiEnabled,
        uiDist: options.uiDist,
      });

      if (uiEnabled && !uiDistPath) {
        console.warn("Web UI dist not found. Starting without UI.");
        console.warn("To include UI, build the web app or specify --ui-dist");
      }

      // Start the unified server
      await startUnifiedServer({
        port: parseInt(options.port, 10),
        adminApi: {
          db: database,
          enableCors: false,
          enableLogger: false,
        },
        proxy: {
          databasePath: dbPath,
        },
        staticServer: uiDistPath
          ? {
              staticPath: uiDistPath,
              indexFile: "index.html",
              spaMode: true,
            }
          : undefined,
        enableCors: true,
        enableLogger: true,
        enableCompress: true,
      });
    } catch (error) {
      database?.close();
      console.error("Failed to start server:", error);
      process.exit(1);
    }
  });

// Add a stop command for graceful shutdown
program
  .command("status")
  .description("Check if the server is running")
  .action(() => {
    console.log("Server status check not implemented yet");
  });

program.parse();
