import { and, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { createDatabase } from "../storage/database.js";
import { pluginBundles, pluginMigrations } from "../storage/schema.js";
import type { DatabaseClient } from "../storage/types.js";
import type { PluginDefinition, PluginMigration } from "./types.js";

export async function runPluginMigrations(
  rawDb: DatabaseClient,
  plugins: PluginDefinition[],
): Promise<void> {
  const db = createDatabase(rawDb);
  const sortedPlugins = [...plugins].sort((a, b) => a.name.localeCompare(b.name));

  for (const plugin of sortedPlugins) {
    const now = new Date().toISOString();
    const pluginChecksum = getPluginDefinitionChecksum(plugin);

    await db
      .insert(pluginBundles)
      .values({
        name: plugin.name,
        version: plugin.version,
        checksum: pluginChecksum,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: pluginBundles.name,
        set: {
          version: plugin.version,
          checksum: pluginChecksum,
          updatedAt: now,
        },
      });

    const migrations = [...(plugin.migrations ?? [])].sort((a, b) => a.id.localeCompare(b.id));

    for (const migration of migrations) {
      const checksum = getPluginMigrationChecksum(migration);
      const applied = await db
        .select({
          checksum: pluginMigrations.checksum,
        })
        .from(pluginMigrations)
        .where(
          and(
            eq(pluginMigrations.pluginName, plugin.name),
            eq(pluginMigrations.migrationId, migration.id),
          ),
        )
        .get();

      if (applied) {
        if (applied.checksum !== checksum) {
          throw new Error(`Plugin migration checksum mismatch for ${plugin.name}:${migration.id}.`);
        }
        continue;
      }

      await applyPluginMigration(rawDb, migration);
      await db.insert(pluginMigrations).values({
        pluginName: plugin.name,
        migrationId: migration.id,
        checksum,
        appliedAt: new Date().toISOString(),
      });
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

  return createHash("sha256").update(`${migration.id}:${migration.sql}`).digest("hex");
}

async function applyPluginMigration(
  rawDb: DatabaseClient,
  migration: PluginMigration,
): Promise<void> {
  await rawDb.executeMultiple(migration.sql);
}
