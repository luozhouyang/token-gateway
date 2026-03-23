import type { PluginDefinition, PluginStorageContext } from "./types.js";

export function createPluginStorageContext(
  rawDb: PluginStorageContext["rawDb"],
  plugin: Pick<PluginDefinition, "name" | "version">,
): PluginStorageContext {
  return {
    pluginName: plugin.name,
    pluginVersion: plugin.version,
    rawDb,
    exec: (sql: string) => {
      rawDb.exec(sql);
    },
    transaction: <T>(fn: () => T): T => rawDb.transaction(fn)(),
  };
}
