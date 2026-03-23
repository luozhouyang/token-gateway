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

  test("registers builtin plugin bundles and migrations during startup", () => {
    runMigrations(dbPath);
    db = new DatabaseService(dbPath);

    const rawDb = db.getRawDatabase();
    const bundle = rawDb
      .prepare("SELECT name, version FROM plugin_bundles WHERE name = ?")
      .get("rate-limit") as { name: string; version: string } | undefined;
    const migration = rawDb
      .prepare("SELECT migration_id FROM plugin_migrations WHERE plugin_name = ?")
      .get("rate-limit") as { migration_id: string } | undefined;

    expect(bundle).toMatchObject({
      name: "rate-limit",
      version: RateLimitVersion,
    });
    expect(migration).toMatchObject({
      migration_id: "0001_init",
    });
  });

  test("applies custom plugin migrations passed to runMigrations", () => {
    const customPlugin: PluginDefinition = {
      name: "custom-db-plugin",
      version: "1.0.0",
      phases: ["access"],
      migrations: [
        {
          id: "0001_init",
          up: `
            CREATE TABLE IF NOT EXISTS plugin_custom_db_plugin_entries (
              id text PRIMARY KEY NOT NULL,
              value text NOT NULL
            );
          `,
        },
      ],
    };

    runMigrations(dbPath, {
      plugins: [customPlugin],
    });
    db = new DatabaseService(dbPath);

    const rawDb = db.getRawDatabase();
    const table = rawDb
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'plugin_custom_db_plugin_entries'",
      )
      .get() as { name: string } | undefined;
    const migration = rawDb
      .prepare("SELECT migration_id FROM plugin_migrations WHERE plugin_name = ?")
      .get("custom-db-plugin") as { migration_id: string } | undefined;

    expect(table).toMatchObject({
      name: "plugin_custom_db_plugin_entries",
    });
    expect(migration).toMatchObject({
      migration_id: "0001_init",
    });
  });
});

const RateLimitVersion = "3.0.0";
