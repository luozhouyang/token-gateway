// Plugins Routes

import { Hono } from "hono";
import { ZodError } from "zod";
import { zodValidator } from "../middleware/zod-validator.js";
import {
  createPluginSchema,
  updatePluginSchema,
  paginationSchema,
  pluginFilterSchema,
} from "../schemas.js";
import { toPluginResponse, successResponse, listResponse } from "../responses.js";
import { ApiError } from "../server.js";
import { PluginBindingRepository } from "../../entities/plugin-binding.js";
import { DatabaseService } from "../../storage/database.js";
import { PluginManager } from "../../plugins/plugin-manager.js";
import type { PluginDefinition } from "../../plugins/types.js";

export function createPluginsRoutes(db: DatabaseService, pluginManager?: PluginManager) {
  const routes = new Hono();
  const pluginRepo = new PluginBindingRepository(db);
  const manager = pluginManager ?? new PluginManager(db);

  routes.get("/definitions", async (c) => {
    const definitions = manager.listAvailableDefinitions().map(toPluginDefinitionResponse);
    return c.json(successResponse(definitions));
  });

  // List plugins
  routes.get("/", zodValidator("query", paginationSchema.merge(pluginFilterSchema)), async (c) => {
    const query = c.req.valid("query");
    const { limit, offset } = query;

    const plugins = await pluginRepo.findAll({
      limit,
      offset,
      orderBy: "createdAt",
      order: "desc",
    });

    // Apply filters
    const filtered = plugins.filter((p) => {
      if (query.name && !p.name.toLowerCase().includes(query.name.toLowerCase())) return false;
      if (query.serviceId && p.serviceId !== query.serviceId) return false;
      if (query.routeId && p.routeId !== query.routeId) return false;
      if (query.consumerId && p.consumerId !== query.consumerId) return false;
      if (query.enabled !== undefined && p.enabled !== query.enabled) return false;
      return true;
    });

    const total = filtered.length;

    return c.json(
      listResponse(filtered.map(toPluginResponse), {
        limit,
        offset,
        total,
        hasMore: offset + limit < total,
      }),
    );
  });

  // Create plugin
  routes.post("/", zodValidator("json", createPluginSchema), async (c) => {
    const body = c.req.valid("json");

    const plugin = await createOrThrowBadRequest(() =>
      manager.createPlugin({
        name: body.name,
        serviceId: body.serviceId ?? undefined,
        routeId: body.routeId ?? undefined,
        consumerId: body.consumerId ?? undefined,
        config: body.config ?? {},
        enabled: body.enabled ?? true,
        tags: body.tags ?? [],
      }),
    );

    return c.json(successResponse(toPluginResponse(plugin)), 201);
  });

  // Get plugin
  routes.get("/:id", async (c) => {
    const { id } = c.req.param();
    const plugin = await pluginRepo.findById(id);

    if (!plugin) {
      throw ApiError.notFound("Plugin");
    }

    return c.json(successResponse(toPluginResponse(plugin)));
  });

  // Update plugin
  routes.put("/:id", zodValidator("json", updatePluginSchema), async (c) => {
    const { id } = c.req.param();
    const body = c.req.valid("json");

    const plugin = await pluginRepo.findById(id);
    if (!plugin) {
      throw ApiError.notFound("Plugin");
    }

    const updated = await createOrThrowBadRequest(() =>
      manager.updatePlugin(id, {
        name: body.name,
        serviceId: body.serviceId,
        routeId: body.routeId,
        consumerId: body.consumerId,
        config: body.config ?? undefined,
        enabled: body.enabled,
        tags: body.tags,
      }),
    );

    if (!updated) {
      throw ApiError.notFound("Plugin");
    }

    return c.json(successResponse(toPluginResponse(updated)));
  });

  // Delete plugin
  routes.delete("/:id", async (c) => {
    const { id } = c.req.param();

    const plugin = await pluginRepo.findById(id);
    if (!plugin) {
      throw ApiError.notFound("Plugin");
    }

    await manager.deletePlugin(id);
    return c.json(successResponse({ deleted: true }), 200);
  });

  return routes;
}

async function createOrThrowBadRequest<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unknown plugin:")) {
      throw ApiError.badRequest(error.message);
    }

    if (error instanceof Error && error.message.startsWith("Invalid plugin config:")) {
      throw ApiError.badRequest(error.message);
    }

    if (error instanceof ZodError) {
      throw ApiError.badRequest(
        "Plugin config validation failed",
        error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      );
    }

    throw error;
  }
}

function toPluginDefinitionResponse(definition: PluginDefinition) {
  return {
    name: definition.name,
    displayName: definition.displayName ?? definition.name,
    description: definition.description ?? null,
    version: definition.version,
    phases: definition.phases,
    hasConfigSchema: definition.configSchema !== undefined,
    configDescriptor: definition.configDescriptor ?? null,
  };
}
