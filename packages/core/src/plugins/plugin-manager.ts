import { DatabaseService } from "../storage/database.js";
import { PluginBindingRepository } from "../entities/plugin-binding.js";
import type { PluginDefinition, PluginContext, PluginPhase, PluginInstance } from "./types.js";
import { PluginLoader } from "./plugin-loader.js";
import { eq, isNull, and } from "drizzle-orm";
import { plugins } from "../storage/schema.js";

/**
 * PluginManager - Manages plugin lifecycle and execution
 *
 * Key Design:
 * - PluginDefinition: The plugin code (singleton), contains handlers like onRequest/onResponse
 * - PluginInstance: A runtime instance of a plugin (can have multiple), contains specific config and bindings
 *
 * The same plugin name (e.g., "cors") can have multiple instances at different levels (service/route/consumer),
 * each with its own configuration.
 */
export class PluginManager {
  private db: DatabaseService;
  private pluginRepo: PluginBindingRepository;
  private loader: PluginLoader;

  // Custom plugin definitions (code level)
  private customPlugins: Map<string, PluginDefinition> = new Map();

  // Plugin definition cache (code level, cached by name)
  private pluginDefsCache: Map<string, PluginDefinition> = new Map();

  // Plugin instance cache (cached by dimension: routeId/serviceId/consumerId -> PluginInstance[])
  private instancesCache: Map<string, PluginInstance[]> = new Map();

  private cacheValid = false;

  constructor(db: DatabaseService) {
    this.db = db;
    this.pluginRepo = new PluginBindingRepository(db);
    this.loader = new PluginLoader();
  }

  /**
   * Register a custom plugin definition (code level)
   */
  registerPlugin(plugin: PluginDefinition): void {
    this.customPlugins.set(plugin.name, plugin);
    this.invalidateCache();
  }

  /**
   * Unregister a custom plugin
   */
  unregisterPlugin(name: string): void {
    this.customPlugins.delete(name);
    this.invalidateCache();
  }

  /**
   * Get all plugin instances for a specific route
   * Returns PluginInstance[], each instance has independent configuration
   */
  async getPluginInstancesForRoute(routeId: string, serviceId?: string): Promise<PluginInstance[]> {
    return this.getPluginInstances({ routeId, serviceId });
  }

  /**
   * Get all plugin instances for a specific service
   */
  async getPluginInstancesForService(serviceId: string): Promise<PluginInstance[]> {
    return this.getPluginInstances({ serviceId });
  }

  /**
   * Get all plugin instances for a specific consumer
   */
  async getPluginInstancesForConsumer(consumerId: string): Promise<PluginInstance[]> {
    return this.getPluginInstances({ consumerId });
  }

  /**
   * Get all global plugin instances (not bound to any route/service/consumer)
   */
  async getGlobalPluginInstances(): Promise<PluginInstance[]> {
    return this.getPluginInstances({ global: true });
  }

  /**
   * Create a new plugin binding (instance)
   */
  async createPlugin(input: {
    name: string;
    serviceId?: string;
    routeId?: string;
    consumerId?: string;
    config: Record<string, unknown>;
    enabled?: boolean;
    tags?: string[];
  }): Promise<PluginInstance> {
    const binding = await this.pluginRepo.create({
      name: input.name,
      serviceId: input.serviceId,
      routeId: input.routeId,
      consumerId: input.consumerId,
      config: input.config,
      enabled: input.enabled ?? true,
      tags: input.tags ?? [],
    });

    // Convert to PluginInstance
    const instance = await this.bindingToInstance(binding);

    this.invalidateCache();

    return instance;
  }

  /**
   * Delete a plugin binding
   */
  async deletePlugin(pluginId: string): Promise<boolean> {
    const result = await this.pluginRepo.delete(pluginId);
    if (result) {
      this.invalidateCache();
    }
    return result;
  }

  /**
   * Update a plugin binding
   */
  async updatePlugin(
    pluginId: string,
    updates: {
      name?: string;
      config?: Record<string, unknown>;
      enabled?: boolean;
    },
  ): Promise<PluginInstance | null> {
    const binding = await this.pluginRepo.findById(pluginId);
    if (!binding) {
      return null;
    }

    const updated = await this.pluginRepo.update(pluginId, {
      name: updates.name,
      config: updates.config,
      enabled: updates.enabled,
    });

    this.invalidateCache();

    return this.bindingToInstance(updated);
  }

  /**
   * Execute a single plugin instance handler
   */
  async executePlugin(
    phase: PluginPhase,
    instance: PluginInstance,
    ctx: PluginContext,
  ): Promise<{ stopped: boolean; response?: Response; error?: Error }> {
    // Load plugin definition (code)
    const pluginDef = await this.loadPluginDef(instance.name);

    if (!pluginDef) {
      console.warn(`Plugin definition "${instance.name}" not found`);
      return { stopped: false };
    }

    // Check if plugin has handler for this phase
    const handler = this.getHandlerForPhase(pluginDef, phase);
    if (!handler) {
      return { stopped: false };
    }

    try {
      // Set plugin instance and config in context
      ctx.plugin = instance;
      ctx.config = instance.config || {};

      // Execute handler
      const result = await handler(ctx);

      if (!result) {
        return { stopped: false };
      }

      // Handle response
      if (result.stop) {
        return { stopped: true, response: result.response };
      }

      if (result.error) {
        return { stopped: true, error: result.error };
      }

      return { stopped: false, response: result.response };
    } catch (error) {
      return {
        stopped: true,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Execute all plugin instances by priority
   * Priority: Higher value executes first
   */
  async executeAllPluginInstances(
    phase: PluginPhase,
    instances: PluginInstance[],
    ctx: PluginContext,
  ): Promise<{ stopped: boolean; response?: Response; error?: Error }> {
    // Sort by priority (higher first)
    const sortedInstances = [...instances].sort((a, b) => {
      const aPriority = a.priority ?? 0;
      const bPriority = b.priority ?? 0;
      return bPriority - aPriority;
    });

    for (const instance of sortedInstances) {
      if (!instance.enabled) continue;

      const result = await this.executePlugin(phase, instance, ctx);

      if (result.stopped) {
        return result;
      }
    }

    return { stopped: false };
  }

  /**
   * Invalidate cache
   */
  private invalidateCache(): void {
    this.cacheValid = false;
    this.instancesCache.clear();
    // Note: Do not clear pluginDefsCache, as plugin definitions are singletons
  }

  /**
   * Get plugin instances by condition
   */
  private async getPluginInstances(options: {
    routeId?: string;
    serviceId?: string;
    consumerId?: string;
    global?: boolean;
  }): Promise<PluginInstance[]> {
    // Generate cache key
    const cacheKey = this.getCacheKey(options);
    if (this.cacheValid && this.instancesCache.has(cacheKey)) {
      return this.instancesCache.get(cacheKey)!;
    }

    const db = this.db.getDrizzleDb();

    // Build query conditions
    const conditions: any[] = [];
    if (options.routeId) {
      conditions.push(eq(plugins.routeId, options.routeId));
    }
    if (options.serviceId) {
      conditions.push(eq(plugins.serviceId, options.serviceId));
    }
    if (options.consumerId) {
      conditions.push(eq(plugins.consumerId, options.consumerId));
    }
    if (options.global) {
      // Global plugins: all three IDs are null
      conditions.push(
        and(isNull(plugins.routeId), isNull(plugins.serviceId), isNull(plugins.consumerId)),
      );
    }

    // Only query enabled plugins
    conditions.push(eq(plugins.enabled, true));

    const rows = db
      .select()
      .from(plugins)
      .where(and(...conditions))
      .all();

    // Convert to PluginInstance[]
    const instances: PluginInstance[] = [];
    for (const row of rows) {
      const instance = await this.bindingToInstance(row as any);
      if (instance) {
        instances.push(instance);
      }
    }

    // Cache results
    this.instancesCache.set(cacheKey, instances);

    return instances;
  }

  /**
   * Generate cache key
   */
  private getCacheKey(options: {
    routeId?: string;
    serviceId?: string;
    consumerId?: string;
    global?: boolean;
  }): string {
    if (options.global) return "global";
    if (options.consumerId) return `consumer:${options.consumerId}`;
    if (options.routeId) return `route:${options.routeId}`;
    if (options.serviceId) return `service:${options.serviceId}`;
    return "all";
  }

  /**
   * Load plugin definition (code)
   */
  private async loadPluginDef(name: string): Promise<PluginDefinition | null> {
    // Check cache
    const cached = this.pluginDefsCache.get(name);
    if (cached) {
      return cached;
    }

    // Check custom plugins
    const custom = this.customPlugins.get(name);
    if (custom) {
      this.pluginDefsCache.set(name, custom);
      return custom;
    }

    // Load built-in plugin
    try {
      const builtin = await this.loader.loadBuiltin(name);
      this.pluginDefsCache.set(name, builtin);
      return builtin;
    } catch {
      console.warn(`Plugin definition "${name}" not found`);
      return null;
    }
  }

  /**
   * Convert database row to PluginInstance
   */
  private async bindingToInstance(binding: any): Promise<PluginInstance> {
    // Load plugin definition to get priority
    const pluginDef = await this.loadPluginDef(binding.name);
    const basePriority = pluginDef?.priority ?? 0;

    return {
      id: binding.id,
      name: binding.name,
      serviceId: binding.serviceId,
      routeId: binding.routeId,
      consumerId: binding.consumerId,
      config: binding.config || {},
      enabled: binding.enabled,
      tags: binding.tags || [],
      priority: basePriority,
    };
  }

  /**
   * Get handler for specific phase
   */
  private getHandlerForPhase(
    plugin: PluginDefinition,
    phase: PluginPhase,
  ): PluginDefinition["onRequest" | "onResponse" | "onError"] | null {
    switch (phase) {
      case "request":
        return plugin.onRequest || null;
      case "response":
        return plugin.onResponse || null;
      case "error":
        return plugin.onError || null;
      default:
        return null;
    }
  }

  /**
   * Manually set cache valid (for testing)
   */
  setCacheValid(valid: boolean): void {
    this.cacheValid = valid;
  }
}
