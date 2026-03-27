/// <reference types="node" />

import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { DatabaseService } from "../storage/database.js";
import { runMigrations } from "../storage/migrations.js";
import type { PluginDefinition } from "./types.js";

describe("plugin migration infrastructure", () => {
  let tempDir: string;
  let dbPath: string;
  let db: DatabaseService | null;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "plugin-migrations-test-"));
    dbPath = join(tempDir, "test.db");
    db = null;
  });

  afterEach(() => {
    db?.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("registers builtin plugin bundles and migrations during startup", async () => {
    await runMigrations(dbPath);
    db = new DatabaseService(dbPath);

    const rawDb = db.getRawDatabase();
    const bundle = (
      await rawDb.execute({
        sql: "SELECT name, version FROM plugin_bundles WHERE name = ?",
        args: ["rate-limit"],
      })
    ).rows[0] as unknown as { name: string; version: string } | undefined;
    const migration = (
      await rawDb.execute({
        sql: "SELECT migration_id FROM plugin_migrations WHERE plugin_name = ?",
        args: ["rate-limit"],
      })
    ).rows[0] as unknown as { migration_id: string } | undefined;

    expect(bundle).toMatchObject({
      name: "rate-limit",
      version: RateLimitVersion,
    });
    expect(migration).toBeUndefined();
  });

  test("applies custom plugin migrations passed to runMigrations", async () => {
    const customPlugin: PluginDefinition = {
      name: "custom-db-plugin",
      version: "1.0.0",
      phases: ["access"],
      migrations: [
        {
          id: "0001_init",
          sql: `
            CREATE TABLE IF NOT EXISTS plugin_custom_db_plugin_entries (
              id text PRIMARY KEY NOT NULL,
              value text NOT NULL
            );
          `,
        },
      ],
    };

    await runMigrations(dbPath, {
      plugins: [customPlugin],
    });
    db = new DatabaseService(dbPath);

    const rawDb = db.getRawDatabase();
    const table = (
      await rawDb.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'plugin_custom_db_plugin_entries'",
      )
    ).rows[0] as unknown as { name: string } | undefined;
    const migration = (
      await rawDb.execute({
        sql: "SELECT migration_id FROM plugin_migrations WHERE plugin_name = ?",
        args: ["custom-db-plugin"],
      })
    ).rows[0] as unknown as { migration_id: string } | undefined;

    expect(table).toMatchObject({
      name: "plugin_custom_db_plugin_entries",
    });
    expect(migration).toMatchObject({
      migration_id: "0001_init",
    });
  });

  test("reconciles a drifted drizzle migration journal before applying migrations", async () => {
    await runMigrations(dbPath);
    db = new DatabaseService(dbPath);

    const rawDb = db.getRawDatabase();
    await rawDb.execute(`DELETE FROM __drizzle_migrations`);
    await rawDb.execute({
      sql: `INSERT INTO __drizzle_migrations ("hash", "created_at") VALUES (?, ?)`,
      args: ["manual-0000", CoreMigrationMillis.initialSchema],
    });
    await rawDb.execute({
      sql: `INSERT INTO __drizzle_migrations ("hash", "created_at") VALUES (?, ?)`,
      args: ["manual-0001", CoreMigrationMillis.removePluginOrdering],
    });

    db.close();
    db = null;

    await runMigrations(dbPath);
    db = new DatabaseService(dbPath);

    const reconciledRows = (
      await db
        .getRawDatabase()
        .execute(`SELECT created_at FROM __drizzle_migrations ORDER BY created_at ASC`)
    ).rows as unknown as Array<{
      created_at: bigint | number | string;
    }>;
    const reconciledMillis = reconciledRows.map((row) => Number(row.created_at));

    expect(reconciledMillis).toEqual([
      CoreMigrationMillis.initialSchema,
      CoreMigrationMillis.removePluginOrdering,
      CoreMigrationMillis.pluginRuntimeExtensions,
      CoreMigrationMillis.llmResources,
      CoreMigrationMillis.pluginBuiltinRuntimeTables,
    ]);
  });
});

const RateLimitVersion = "3.0.0";
const CoreMigrationMillis = {
  initialSchema: 1773721556491,
  removePluginOrdering: 1774320000000,
  pluginRuntimeExtensions: 1774320000001,
  llmResources: 1774320000002,
  pluginBuiltinRuntimeTables: 1774532028380,
} as const;
