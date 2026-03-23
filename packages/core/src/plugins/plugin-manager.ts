import { DatabaseService } from "../storage/database.js";
import { PluginBindingRepository } from "../entities/plugin-binding.js";
import type { PluginBinding } from "../entities/types.js";
import type {
  PluginContext,
  PluginDefinition,
  PluginHandler,
  PluginHandlerResult,
  PluginInstance,
  PluginPhase,
} from "./types.js";
import { PluginLoader } from "./plugin-loader.js";
import { plugins } from "../storage/schema.js";
import { toResponseState } from "./runtime.js";
import { eq } from "drizzle-orm";
import { createPluginStorageContext } from "./storage-context.js";

export interface PluginResolutionContext {
  routeId?: string | null;
  serviceId?: string | null;
  consumerId?: string | null;
}

export class PluginManager {
  private readonly db: DatabaseService;
  private readonly pluginRepo: PluginBindingRepository;
  private readonly loader: PluginLoader;
  private readonly customPlugins = new Map<string, PluginDefinition>();
  private readonly pluginDefsCache = new Map<string, PluginDefinition>();
  private readonly pluginStorageCache = new Map<string, unknown>();
  private allEnabledInstancesCache: PluginInstance[] | null = null;

  constructor(db: DatabaseService) {
    this.db = db;
    this.pluginRepo = new PluginBindingRepository(db);
    this.loader = new PluginLoader();
  }

  registerPlugin(plugin: PluginDefinition): void {
    this.customPlugins.set(plugin.name, plugin);
    this.pluginDefsCache.delete(plugin.name);
    this.pluginStorageCache.delete(plugin.name);
  }

  unregisterPlugin(name: string): void {
    this.customPlugins.delete(name);
    this.pluginDefsCache.delete(name);
    this.pluginStorageCache.delete(name);
  }

  async getPluginInstancesForRoute(routeId: string, serviceId?: string): Promise<PluginInstance[]> {
    return this.filterExactScope({
      routeId,
      serviceId: serviceId ?? null,
    });
  }

  async getPluginInstancesForService(serviceId: string): Promise<PluginInstance[]> {
    return this.filterExactScope({
      serviceId,
      routeId: null,
      consumerId: null,
    });
  }

  async getPluginInstancesForConsumer(consumerId: string): Promise<PluginInstance[]> {
    return this.filterExactScope({
      consumerId,
      routeId: null,
      serviceId: null,
    });
  }

  async getGlobalPluginInstances(): Promise<PluginInstance[]> {
    return this.filterExactScope({
      routeId: null,
      serviceId: null,
      consumerId: null,
    });
  }

  async resolvePluginInstances(context: PluginResolutionContext): Promise<PluginInstance[]> {
    const allInstances = await this.getAllEnabledPluginInstances();
    const applicable = allInstances.filter((instance) =>
      this.matchesResolutionContext(instance, context),
    );

    const selectedByName = new Map<string, PluginInstance>();
    for (const instance of applicable) {
      const current = selectedByName.get(instance.name);
      if (!current || this.compareInstanceSpecificity(instance, current) > 0) {
        selectedByName.set(instance.name, instance);
      }
    }

    return this.sortInstances(Array.from(selectedByName.values()));
  }

  async createPlugin(input: {
    name: string;
    serviceId?: string;
    routeId?: string;
    consumerId?: string;
    config: Record<string, unknown>;
    enabled?: boolean;
    tags?: string[];
  }): Promise<PluginInstance> {
    const config = await this.validateAndNormalizeConfig(input.name, input.config);
    const binding = await this.pluginRepo.create({
      name: input.name,
      serviceId: input.serviceId,
      routeId: input.routeId,
      consumerId: input.consumerId,
      config,
      enabled: input.enabled ?? true,
      tags: input.tags ?? [],
    });

    this.invalidateCache();
    return this.bindingToInstance(binding);
  }

  async deletePlugin(pluginId: string): Promise<boolean> {
    const deleted = await this.pluginRepo.delete(pluginId);
    if (deleted) {
      this.invalidateCache();
    }
    return deleted;
  }

  async updatePlugin(
    pluginId: string,
    updates: {
      name?: string;
      serviceId?: string | null;
      routeId?: string | null;
      consumerId?: string | null;
      config?: Record<string, unknown>;
      enabled?: boolean;
      tags?: string[];
    },
  ): Promise<PluginInstance | null> {
    const binding = await this.pluginRepo.findById(pluginId);
    if (!binding) {
      return null;
    }

    const targetName = updates.name ?? binding.name;
    const config = await this.validateAndNormalizeConfig(
      targetName,
      updates.config ?? ((binding.config as Record<string, unknown>) || {}),
    );
    const updated = await this.pluginRepo.update(pluginId, {
      name: targetName,
      serviceId: updates.serviceId,
      routeId: updates.routeId,
      consumerId: updates.consumerId,
      config,
      enabled: updates.enabled,
      tags: updates.tags,
    });

    this.invalidateCache();
    return this.bindingToInstance(updated);
  }

  async executePlugin(
    phase: PluginPhase,
    instance: PluginInstance,
    ctx: PluginContext,
  ): Promise<{ stopped: boolean; response?: Response; error?: Error }> {
    const pluginDef = await this.loadPluginDef(instance.name);
    if (!pluginDef) {
      return { stopped: false };
    }

    const handler = this.getHandlerForPhase(pluginDef, phase);
    if (!handler) {
      return { stopped: false };
    }

    try {
      ctx.phase = phase;
      ctx.plugin = instance;
      ctx.config = instance.config || {};
      ctx.pluginStorage = this.getPluginStorage(pluginDef);

      const result = await handler(ctx);
      return normalizeHandlerResult(result);
    } catch (error) {
      return {
        stopped: true,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async executePhase(
    phase: PluginPhase,
    instances: PluginInstance[],
    ctx: PluginContext,
  ): Promise<{ stopped: boolean; response?: Response; error?: Error }> {
    for (const instance of this.sortInstances(instances)) {
      if (!instance.enabled) {
        continue;
      }

      const result = await this.executePlugin(phase, instance, ctx);
      if (result.error) {
        return result;
      }

      if (result.response && phase !== "access") {
        ctx.response = await toResponseState(result.response, "gateway");
      }

      if (result.stopped || result.response) {
        return result;
      }
    }

    return { stopped: false };
  }

  private invalidateCache(): void {
    this.allEnabledInstancesCache = null;
  }

  private async filterExactScope(scope: PluginResolutionContext): Promise<PluginInstance[]> {
    const allInstances = await this.getAllEnabledPluginInstances();
    return this.sortInstances(
      allInstances.filter((instance) => this.matchesExactScope(instance, scope)),
    );
  }

  private async getAllEnabledPluginInstances(): Promise<PluginInstance[]> {
    if (this.allEnabledInstancesCache) {
      return this.allEnabledInstancesCache;
    }

    const db = this.db.getDrizzleDb();
    const rows = db.select().from(plugins).where(eq(plugins.enabled, true)).all();
    const instances = await Promise.all(rows.map((row) => this.bindingToInstance(row)));
    this.allEnabledInstancesCache = instances;
    return instances;
  }

  private matchesResolutionContext(
    instance: PluginInstance,
    context: PluginResolutionContext,
  ): boolean {
    if (instance.routeId && instance.routeId !== context.routeId) {
      return false;
    }

    if (instance.serviceId && instance.serviceId !== context.serviceId) {
      return false;
    }

    if (instance.consumerId && instance.consumerId !== context.consumerId) {
      return false;
    }

    return true;
  }

  private matchesExactScope(instance: PluginInstance, scope: PluginResolutionContext): boolean {
    return (
      (instance.routeId ?? null) === (scope.routeId ?? null) &&
      (instance.serviceId ?? null) === (scope.serviceId ?? null) &&
      (instance.consumerId ?? null) === (scope.consumerId ?? null)
    );
  }

  private compareInstanceSpecificity(a: PluginInstance, b: PluginInstance): number {
    const scopeDiff = this.getScopeRank(a) - this.getScopeRank(b);
    if (scopeDiff !== 0) {
      return scopeDiff;
    }

    const updatedDiff =
      new Date(a.updatedAt || a.createdAt || 0).getTime() -
      new Date(b.updatedAt || b.createdAt || 0).getTime();
    if (updatedDiff !== 0) {
      return updatedDiff;
    }

    return a.id.localeCompare(b.id);
  }

  private getScopeRank(instance: PluginInstance): number {
    const hasConsumer = Boolean(instance.consumerId);
    const hasRoute = Boolean(instance.routeId);
    const hasService = Boolean(instance.serviceId);

    if (hasConsumer && hasRoute && hasService) return 8;
    if (hasConsumer && hasRoute) return 7;
    if (hasConsumer && hasService) return 6;
    if (hasRoute && hasService) return 5;
    if (hasConsumer) return 4;
    if (hasRoute) return 3;
    if (hasService) return 2;
    return 1;
  }

  private sortInstances(instances: PluginInstance[]): PluginInstance[] {
    return [...instances].sort((a, b) => {
      const priorityDiff = (b.priority ?? 0) - (a.priority ?? 0);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      return a.name.localeCompare(b.name);
    });
  }

  private async loadPluginDef(name: string): Promise<PluginDefinition | null> {
    const cached = this.pluginDefsCache.get(name);
    if (cached) {
      return cached;
    }

    const customPlugin = this.customPlugins.get(name);
    if (customPlugin) {
      this.pluginDefsCache.set(name, customPlugin);
      return customPlugin;
    }

    try {
      const builtin = await this.loader.loadBuiltin(name);
      this.pluginDefsCache.set(name, builtin);
      return builtin;
    } catch {
      return null;
    }
  }

  private async bindingToInstance(binding: PluginBinding): Promise<PluginInstance> {
    const pluginDef = await this.loadPluginDef(binding.name);
    const config = await this.normalizeInstanceConfig(
      binding.name,
      (binding.config as Record<string, unknown>) || {},
      pluginDef,
    );

    return {
      id: binding.id,
      name: binding.name,
      serviceId: binding.serviceId,
      routeId: binding.routeId,
      consumerId: binding.consumerId,
      config,
      enabled: binding.enabled ?? true,
      tags: (binding.tags as string[]) ?? [],
      priority: pluginDef?.priority ?? 0,
      createdAt: binding.createdAt ?? undefined,
      updatedAt: binding.updatedAt ?? undefined,
    };
  }

  private getHandlerForPhase(plugin: PluginDefinition, phase: PluginPhase): PluginHandler | null {
    switch (phase) {
      case "access":
        return plugin.onAccess || null;
      case "response":
        return plugin.onResponse || null;
      case "log":
        return plugin.onLog || null;
      default:
        return null;
    }
  }

  private getPluginStorage(plugin: PluginDefinition): unknown {
    if (this.pluginStorageCache.has(plugin.name)) {
      return this.pluginStorageCache.get(plugin.name);
    }

    if (!plugin.createStorage) {
      return undefined;
    }

    const storage = plugin.createStorage(
      createPluginStorageContext(this.db.getRawDatabase(), plugin),
    );
    this.pluginStorageCache.set(plugin.name, storage);
    return storage;
  }

  private async validateAndNormalizeConfig(
    name: string,
    config: Record<string, unknown> | null | undefined,
  ): Promise<Record<string, unknown>> {
    const pluginDef = await this.loadPluginDef(name);
    if (!pluginDef) {
      throw new Error(`Unknown plugin: ${name}`);
    }

    return this.normalizeInstanceConfig(name, config ?? {}, pluginDef);
  }

  private async normalizeInstanceConfig(
    _name: string,
    config: Record<string, unknown>,
    pluginDef: PluginDefinition | null,
  ): Promise<Record<string, unknown>> {
    if (!pluginDef?.configSchema) {
      return config;
    }

    return pluginDef.configSchema.parse(config);
  }
}

function normalizeHandlerResult(result: PluginHandlerResult | void): {
  stopped: boolean;
  response?: Response;
  error?: Error;
} {
  if (!result) {
    return { stopped: false };
  }

  return {
    stopped: result.stop === true,
    response: result.response,
  };
}
