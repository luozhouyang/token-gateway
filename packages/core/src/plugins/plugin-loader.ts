import type { PluginDefinition, BuiltinPluginType } from "./types.js";
import { CorsPlugin } from "./builtins/cors.js";
import { LoggerPlugin } from "./builtins/logger.js";
import { RateLimitPlugin } from "./builtins/rate-limit.js";
import { KeyAuthPlugin } from "./builtins/key-auth.js";
import { FileLogPlugin } from "./builtins/file-log.js";
import { LlmInboundAnthropicPlugin } from "./builtins/llm-inbound-anthropic.js";
import { LlmInboundOpenAIPlugin } from "./builtins/llm-inbound-openai.js";
import { LlmRouterPlugin } from "./builtins/llm-router.js";
import { RequestTransformerPlugin } from "./builtins/request-transformer.js";
import { ResponseTransformerPlugin } from "./builtins/response-transformer.js";

export class PluginLoader {
  private builtinPlugins: Map<BuiltinPluginType, PluginDefinition> = new Map();

  constructor() {
    this.registerBuiltinPlugins();
  }

  /**
   * Register all built-in plugins
   */
  private registerBuiltinPlugins(): void {
    this.registerBuiltin(CorsPlugin);
    this.registerBuiltin(LoggerPlugin);
    this.registerBuiltin(RateLimitPlugin);
    this.registerBuiltin(KeyAuthPlugin);
    this.registerBuiltin(FileLogPlugin);
    this.registerBuiltin(LlmInboundOpenAIPlugin);
    this.registerBuiltin(LlmInboundAnthropicPlugin);
    this.registerBuiltin(LlmRouterPlugin);
    this.registerBuiltin(RequestTransformerPlugin);
    this.registerBuiltin(ResponseTransformerPlugin);
  }

  /**
   * Register a single built-in plugin
   */
  private registerBuiltin(plugin: PluginDefinition): void {
    this.builtinPlugins.set(plugin.name as BuiltinPluginType, plugin);
  }

  /**
   * Load a built-in plugin by name
   */
  async loadBuiltin(name: string): Promise<PluginDefinition> {
    const plugin = this.builtinPlugins.get(name as BuiltinPluginType);
    if (!plugin) {
      throw new Error(`Unknown built-in plugin: ${name}`);
    }
    return plugin;
  }

  /**
   * Load a custom plugin from file path
   * Note: In production, this should use a secure sandbox
   */
  async loadFromFile(filePath: string): Promise<PluginDefinition> {
    try {
      // Dynamic import for custom plugins
      const module = await import(filePath);
      const plugin = module.default || module;

      if (!this.isValidPlugin(plugin)) {
        throw new Error(`Invalid plugin structure in ${filePath}`);
      }

      return plugin;
    } catch (error) {
      throw new Error(
        `Failed to load plugin from ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Load a custom plugin from source code string
   * Uses eval with sandbox - should be used carefully
   */
  async loadFromSource(name: string, source: string): Promise<PluginDefinition> {
    try {
      // Create a module from source
      // In production, use a proper sandbox like VM2 or isolated-vm
      const modulePath = `data:text/javascript,${encodeURIComponent(source)}`;
      return await this.loadFromFile(modulePath);
    } catch (error) {
      throw new Error(
        `Failed to load plugin "${name}" from source: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Validate plugin structure
   */
  private isValidPlugin(plugin: unknown): plugin is PluginDefinition {
    if (!plugin || typeof plugin !== "object") {
      return false;
    }

    const p = plugin as Record<string, unknown>;

    // Required fields
    if (typeof p.name !== "string") return false;
    if (typeof p.version !== "string") return false;
    if (!Array.isArray(p.phases)) return false;

    // Validate phases
    const validPhases = ["access", "response", "log"];
    for (const phase of p.phases) {
      if (!validPhases.includes(phase as string)) {
        return false;
      }
    }

    // Validate handlers if present
    if (p.onAccess && typeof p.onAccess !== "function") return false;
    if (p.onResponse && typeof p.onResponse !== "function") return false;
    if (p.onLog && typeof p.onLog !== "function") return false;

    if (p.migrations !== undefined) {
      if (!Array.isArray(p.migrations)) {
        return false;
      }

      for (const migration of p.migrations) {
        if (!migration || typeof migration !== "object") {
          return false;
        }

        const m = migration as Record<string, unknown>;
        if (typeof m.id !== "string") return false;
        if (typeof m.sql !== "string") return false;
        if (m.checksum !== undefined && typeof m.checksum !== "string") return false;
      }
    }

    return true;
  }

  /**
   * List all available built-in plugins
   */
  listBuiltins(): string[] {
    return Array.from(this.builtinPlugins.keys());
  }

  /**
   * List all built-in plugin definitions
   */
  listBuiltinDefinitions(): PluginDefinition[] {
    return Array.from(this.builtinPlugins.values());
  }
}
