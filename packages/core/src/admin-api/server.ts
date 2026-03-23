// Admin API Server Setup

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { errorHandler } from "./middleware/error-handler.js";
import { createServicesRoutes } from "./routes/services.js";
import { createRoutesRoutes } from "./routes/routes.js";
import { createUpstreamsRoutes } from "./routes/upstreams.js";
import { createTargetsRoutes } from "./routes/targets.js";
import { createConsumersRoutes } from "./routes/consumers.js";
import { createCredentialsRoutes } from "./routes/credentials.js";
import { createPluginsRoutes } from "./routes/plugins.js";
import { DatabaseService } from "../storage/database.js";
import { PluginManager } from "../plugins/plugin-manager.js";
import { createLogger, getRequestId, type LogLevel } from "../utils/debug-logger.js";

export interface AdminApiOptions {
  db: DatabaseService;
  basePath?: string;
  enableCors?: boolean;
  enableLogger?: boolean;
  pluginManager?: PluginManager;
  logLevel?: LogLevel;
}

/**
 * Create the Admin API Hono application
 * Routes are mounted at the root level (e.g., /services, /routes, etc.)
 * Callers can wrap this in another Hono app to add a base path if needed.
 */
export function createAdminApi(options: AdminApiOptions): Hono {
  const app = new Hono();
  const debugLogger = createLogger({
    scope: "admin-api",
    level: options.logLevel,
  });

  // Global error handler
  app.onError(errorHandler);

  if (options.enableLogger !== false) {
    app.use("*", logger());
  }

  if (options.enableCors !== false) {
    app.use("*", cors());
  }

  app.use("*", async (c, next) => {
    const requestId = getRequestId(c.req.raw);
    const startTime = Date.now();
    const requestUrl = new URL(c.req.url);

    c.header("X-Request-ID", requestId);
    debugLogger.debug("Admin API request started", {
      requestId,
      method: c.req.method,
      path: c.req.path,
      query: Object.fromEntries(requestUrl.searchParams.entries()),
    });

    try {
      await next();
    } finally {
      debugLogger.debug("Admin API request completed", {
        requestId,
        method: c.req.method,
        path: c.req.path,
        status: c.res.status || 500,
        durationMs: Date.now() - startTime,
      });
    }
  });

  // Register routes at root level
  const servicesRoutes = createServicesRoutes(options.db);
  const routesRoutes = createRoutesRoutes(options.db);
  const upstreamsRoutes = createUpstreamsRoutes(options.db);
  const targetsRoutes = createTargetsRoutes(options.db);
  const consumersRoutes = createConsumersRoutes(options.db);
  const credentialsRoutes = createCredentialsRoutes(options.db);
  const pluginsRoutes = createPluginsRoutes(options.db);

  // Mount routes at root
  // Note: targets and credentials include parent paths in their definitions
  app.route("/services", servicesRoutes);
  app.route("/routes", routesRoutes);
  app.route("/upstreams", upstreamsRoutes);
  app.route("/", targetsRoutes); // Routes include /upstreams/:upstreamId/targets
  app.route("/consumers", consumersRoutes);
  app.route("/", credentialsRoutes); // Routes include /consumers/:consumerId/credentials
  app.route("/plugins", pluginsRoutes);

  // Health check endpoint
  app.get("/health", (c) => {
    return c.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  return app;
}

export { DatabaseService } from "../storage/database.js";
export { ApiError } from "./middleware/error-handler.js";
