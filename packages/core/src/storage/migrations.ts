import { createClient } from "@libsql/client";
import { migrate } from "drizzle-orm/libsql/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";
import * as fs from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PluginLoader } from "../plugins/plugin-loader.js";
import { runPluginMigrations } from "../plugins/plugin-migration-runner.js";
import type { PluginDefinition } from "../plugins/types.js";
import { createDatabase } from "./database.js";
import type { DatabaseClient } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRIZZLE_MIGRATIONS_TABLE = "__drizzle_migrations";

interface MigrationJournalEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}

interface MigrationDescriptor {
  tag: string;
  when: number;
  hash: string;
}

interface SqliteMasterRow {
  name: string;
}

interface SqliteTableInfoRow {
  name: string;
}

interface AppliedMigrationRow {
  created_at: bigint | number | string | null;
}

export interface RunMigrationsOptions {
  plugins?: PluginDefinition[];
}

/**
 * Run database migrations using Drizzle ORM
 * The migrations folder location depends on whether we're running from source or bundled:
 * - Source: src/storage/ -> ../../drizzle
 * - Bundled: dist/storage/ -> ../drizzle
 */
export async function runMigrations(dbPath: string, options?: RunMigrationsOptions): Promise<void> {
  const client = createClient({ url: `file:${dbPath}` });
  const db = createDatabase(client);
  const migrationsFolder = resolveMigrationsFolder();

  try {
    await reconcileLegacyMigrationJournal(client, migrationsFolder);
    await migrate(db, { migrationsFolder });

    const pluginDefinitions = options?.plugins ?? new PluginLoader().listBuiltinDefinitions();
    await runPluginMigrations(client, pluginDefinitions);
  } finally {
    client.close();
  }
}

function resolveMigrationsFolder(): string {
  let migrationsFolder = join(__dirname, "../drizzle");
  try {
    const stat = fs.statSync(migrationsFolder);
    if (!stat.isDirectory()) {
      throw new Error("Not a directory");
    }
  } catch {
    migrationsFolder = join(__dirname, "../../drizzle");
  }

  return migrationsFolder;
}

async function reconcileLegacyMigrationJournal(
  rawDb: DatabaseClient,
  migrationsFolder: string,
): Promise<void> {
  const descriptors = readMigrationDescriptors(migrationsFolder);

  await rawDb.executeMultiple(`
    CREATE TABLE IF NOT EXISTS ${DRIZZLE_MIGRATIONS_TABLE} (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at numeric
    );
  `);

  const rows = (await rawDb.execute(`SELECT created_at FROM ${DRIZZLE_MIGRATIONS_TABLE}`))
    .rows as unknown as AppliedMigrationRow[];
  const appliedMigrationMillis = new Set(
    rows
      .map((row) => toMigrationMillis(row.created_at))
      .filter((value): value is number => value !== null),
  );

  for (const descriptor of descriptors) {
    if (appliedMigrationMillis.has(descriptor.when)) {
      continue;
    }

    if (!(await isMigrationAlreadyReflectedInSchema(rawDb, descriptor.tag))) {
      continue;
    }

    await rawDb.execute({
      sql: `INSERT INTO ${DRIZZLE_MIGRATIONS_TABLE} ("hash", "created_at") VALUES (?, ?)`,
      args: [descriptor.hash, descriptor.when],
    });
    appliedMigrationMillis.add(descriptor.when);
  }
}

function readMigrationDescriptors(migrationsFolder: string): MigrationDescriptor[] {
  const journal = JSON.parse(
    fs.readFileSync(join(migrationsFolder, "meta", "_journal.json"), "utf8"),
  ) as {
    entries: MigrationJournalEntry[];
  };
  const migrationFiles = readMigrationFiles({ migrationsFolder });

  if (journal.entries.length !== migrationFiles.length) {
    throw new Error("Drizzle migration journal and SQL files are out of sync.");
  }

  return journal.entries.map((entry, index) => ({
    tag: entry.tag,
    when: entry.when,
    hash: migrationFiles[index]!.hash,
  }));
}

function toMigrationMillis(value: bigint | number | string | null): number | null {
  if (value === null) {
    return null;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

async function isMigrationAlreadyReflectedInSchema(
  rawDb: DatabaseClient,
  tag: string,
): Promise<boolean> {
  switch (tag) {
    case "0000_gifted_mach_iv":
      return hasAllTables(rawDb, [
        "consumers",
        "credentials",
        "plugins",
        "routes",
        "services",
        "targets",
        "upstreams",
      ]);
    case "0001_remove_plugin_ordering":
      return (
        (await hasTable(rawDb, "plugins")) &&
        !(await hasColumn(rawDb, "plugins", "run_on")) &&
        !(await hasColumn(rawDb, "plugins", "ordering"))
      );
    case "0002_plugin_runtime_extensions":
      return hasAllTables(rawDb, ["plugin_bundles", "plugin_migrations"]);
    case "0003_llm_resources":
      return hasAllTables(rawDb, ["llm_providers", "llm_models"]);
    case "0004_plugin_builtin_runtime_tables":
      return hasAllTables(rawDb, [
        "plugin_rate_limit_counters",
        "plugin_llm_router_circuits",
        "plugin_llm_router_request_logs",
      ]);
    default:
      return false;
  }
}

async function hasAllTables(rawDb: DatabaseClient, tableNames: string[]): Promise<boolean> {
  for (const tableName of tableNames) {
    if (!(await hasTable(rawDb, tableName))) {
      return false;
    }
  }

  return true;
}

async function hasTable(rawDb: DatabaseClient, tableName: string): Promise<boolean> {
  const row = (
    await rawDb.execute({
      sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      args: [tableName],
    })
  ).rows[0] as unknown as SqliteMasterRow | undefined;

  return row?.name === tableName;
}

async function hasColumn(
  rawDb: DatabaseClient,
  tableName: string,
  columnName: string,
): Promise<boolean> {
  const rows = (await rawDb.execute(`PRAGMA table_info("${tableName}")`))
    .rows as unknown as SqliteTableInfoRow[];

  return rows.some((row) => row.name === columnName);
}
