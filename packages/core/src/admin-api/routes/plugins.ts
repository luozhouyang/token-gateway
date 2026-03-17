// Plugins Routes

import { Hono } from "hono";
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

export function createPluginsRoutes(db: DatabaseService) {
  const routes = new Hono();
  const pluginRepo = new PluginBindingRepository(db);

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

    const plugin = await pluginRepo.create({
      name: body.name,
      serviceId: body.serviceId ?? null,
      routeId: body.routeId ?? null,
      consumerId: body.consumerId ?? null,
      config: body.config ?? null,
      enabled: body.enabled ?? true,
      tags: body.tags ?? [],
    });

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

    const updated = await pluginRepo.update(id, {
      name: body.name,
      serviceId: body.serviceId ?? null,
      routeId: body.routeId ?? null,
      consumerId: body.consumerId ?? null,
      config: body.config ?? null,
      enabled: body.enabled,
      tags: body.tags ?? (plugin.tags as string[]),
    });

    return c.json(successResponse(toPluginResponse(updated)));
  });

  // Delete plugin
  routes.delete("/:id", async (c) => {
    const { id } = c.req.param();

    const plugin = await pluginRepo.findById(id);
    if (!plugin) {
      throw ApiError.notFound("Plugin");
    }

    await pluginRepo.delete(id);
    return c.json(successResponse({ deleted: true }), 200);
  });

  return routes;
}
