import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import { createPluginStorageContext } from "./storage-context.js";
import type { PluginDefinition, PluginMigration } from "./types.js";

export function runPluginMigrations(rawDb: Database.Database, plugins: PluginDefinition[]): void {
  ensurePluginRuntimeTables(rawDb);

  const appliedMigrationStmt = rawDb.prepare<
    {
      plugin_name: string;
      migration_id: string;
    },
    { checksum: string }
  >(
    `SELECT checksum
       FROM plugin_migrations
      WHERE plugin_name = @plugin_name
        AND migration_id = @migration_id`,
  );
  const insertAppliedMigrationStmt = rawDb.prepare(
    `INSERT INTO plugin_migrations (plugin_name, migration_id, checksum, applied_at)
          VALUES (?, ?, ?, ?)`,
  );
  const upsertBundleStmt = rawDb.prepare(
    `INSERT INTO plugin_bundles (name, version, checksum, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(name) DO UPDATE SET
       version = excluded.version,
       checksum = excluded.checksum,
       updated_at = excluded.updated_at`,
  );

  const sortedPlugins = [...plugins].sort((a, b) => a.name.localeCompare(b.name));

  for (const plugin of sortedPlugins) {
    const now = new Date().toISOString();
    upsertBundleStmt.run(
      plugin.name,
      plugin.version,
      getPluginDefinitionChecksum(plugin),
      now,
      now,
    );

    const storageContext = createPluginStorageContext(rawDb, plugin);
    const migrations = [...(plugin.migrations ?? [])].sort((a, b) => a.id.localeCompare(b.id));

    for (const migration of migrations) {
      const checksum = getPluginMigrationChecksum(migration);
      const applied = appliedMigrationStmt.get({
        plugin_name: plugin.name,
        migration_id: migration.id,
      });

      if (applied) {
        if (applied.checksum !== checksum) {
          throw new Error(`Plugin migration checksum mismatch for ${plugin.name}:${migration.id}.`);
        }
        continue;
      }

      rawDb.transaction(() => {
        applyPluginMigration(storageContext, migration);
        insertAppliedMigrationStmt.run(
          plugin.name,
          migration.id,
          checksum,
          new Date().toISOString(),
        );
      })();
    }
  }
}

export function getPluginDefinitionChecksum(plugin: PluginDefinition): string {
  const payload = JSON.stringify({
    name: plugin.name,
    version: plugin.version,
    phases: plugin.phases,
    migrations: (plugin.migrations ?? []).map((migration) => ({
      id: migration.id,
      checksum: getPluginMigrationChecksum(migration),
    })),
  });

  return createHash("sha256").update(payload).digest("hex");
}

export function getPluginMigrationChecksum(migration: PluginMigration): string {
  if (migration.checksum) {
    return migration.checksum;
  }

  const payload = typeof migration.up === "string" ? migration.up : migration.up.toString();
  return createHash("sha256").update(`${migration.id}:${payload}`).digest("hex");
}

function applyPluginMigration(
  storageContext: ReturnType<typeof createPluginStorageContext>,
  migration: PluginMigration,
): void {
  if (typeof migration.up === "string") {
    storageContext.exec(migration.up);
    return;
  }

  migration.up(storageContext);
}

function ensurePluginRuntimeTables(rawDb: Database.Database): void {
  rawDb.exec(`
    CREATE TABLE IF NOT EXISTS plugin_bundles (
      name text PRIMARY KEY NOT NULL,
      version text NOT NULL,
      checksum text NOT NULL,
      created_at text,
      updated_at text
    );

    CREATE TABLE IF NOT EXISTS plugin_migrations (
      plugin_name text NOT NULL,
      migration_id text NOT NULL,
      checksum text NOT NULL,
      applied_at text,
      PRIMARY KEY(plugin_name, migration_id),
      FOREIGN KEY (plugin_name) REFERENCES plugin_bundles(name) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_plugin_migrations_plugin_name
      ON plugin_migrations (plugin_name);
  `);
}
