import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import Database from "better-sqlite3";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as fs from "node:fs";
import { PluginLoader } from "../plugins/plugin-loader.js";
import { runPluginMigrations } from "../plugins/plugin-migration-runner.js";
import type { PluginDefinition } from "../plugins/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface RunMigrationsOptions {
  plugins?: PluginDefinition[];
}

/**
 * Run database migrations using Drizzle ORM
 * The migrations folder location depends on whether we're running from source or bundled:
 * - Source: src/storage/ -> ../../drizzle
 * - Bundled: dist/storage/ -> ../drizzle
 */
export function runMigrations(dbPath: string, options?: RunMigrationsOptions): void {
  const client = new Database(dbPath);
  const db = drizzle(client);

  // Try bundled path first (dist/storage -> ../drizzle), then source path (src/storage -> ../../drizzle)
  let migrationsFolder = join(__dirname, "../drizzle");
  try {
    const stat = fs.statSync(migrationsFolder);
    if (!stat.isDirectory()) {
      throw new Error("Not a directory");
    }
  } catch {
    // Fall back to source path
    migrationsFolder = join(__dirname, "../../drizzle");
  }

  try {
    migrate(db, { migrationsFolder });

    const pluginDefinitions = options?.plugins ?? new PluginLoader().listBuiltinDefinitions();
    runPluginMigrations(client, pluginDefinitions);
  } finally {
    client.close();
  }
}
