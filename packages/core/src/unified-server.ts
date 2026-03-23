import { Hono, type Context } from "hono";
import { serve, type ServerType } from "@hono/node-server";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { compress } from "hono/compress";
import { DatabaseService } from "./storage/database.js";
import { createAdminApi, type AdminApiOptions } from "./admin-api/server.js";
import { createStaticServer, type StaticServerOptions } from "./static-server.js";
import { ProxyEngine, type ProxyEngineOptions } from "./engine/proxy-engine.js";
import { PluginManager } from "./plugins/plugin-manager.js";
import { createLogger, type LogLevel } from "./utils/debug-logger.js";

/**
 * Unified server options
 */
export interface UnifiedServerOptions {
  /** Server port */
  port: number;
  /** Admin API options */
  adminApi?: AdminApiOptions;
  /** Static server options (for Web UI) */
  staticServer?: StaticServerOptions;
  /** Proxy engine options */
  proxy?: ProxyEngineOptions;
  /** Enable CORS (default: true) */
  enableCors?: boolean;
  /** Enable request logger (default: true) */
  enableLogger?: boolean;
  /** Enable compression (default: true) */
  enableCompress?: boolean;
  /** Runtime log level */
  logLevel?: LogLevel;
}

/**
 * Create unified server
 *
 * Route priority:
 * 1. /admin/*  → Admin API
 * 2. /ui/*     → Web UI (Static Server)
 * 3. /*        → Proxy Engine (internal matching)
 *
 * @param options - Unified server options
 * @returns Hono application
 */
export async function createUnifiedServer(options: UnifiedServerOptions): Promise<Hono> {
  const app = new Hono();
  const appLogger = createLogger({
    scope: "unified-server",
    level: options.logLevel,
  });
  const sharedDb =
    options.adminApi?.db ??
    (options.proxy ? new DatabaseService(options.proxy.databasePath) : null);
  const sharedPluginManager = sharedDb ? new PluginManager(sharedDb) : undefined;

  // ========== 1. Global Middleware ==========
  if (options.enableLogger !== false) {
    app.use(logger());
  }

  if (options.enableCors !== false) {
    app.use(
      cors({
        origin: "*",
        allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allowHeaders: ["Content-Type", "Authorization", "X-API-Key"],
      }),
    );
  }

  if (options.enableCompress !== false) {
    app.use(compress());
  }

  // ========== 2. Admin API (/admin/*) ==========
  if (options.adminApi && sharedDb) {
    const adminApi = createAdminApi({
      ...options.adminApi,
      db: sharedDb,
      pluginManager: sharedPluginManager,
      enableCors: false,
      enableLogger: false,
      logLevel: options.logLevel,
    });
    app.route("/admin", adminApi);
  }

  // ========== 3. Static Server (/ui/*) ==========
  if (options.staticServer) {
    const staticServer = createStaticServer({
      ...options.staticServer,
      urlPrefix: "/ui",
      // Always enable SPA mode for Web UI
      spaMode: true,
    });
    app.route("/ui", staticServer);
  }

  // ========== 4. Proxy Engine (/*) ==========
  // Proxy engine is last - it has internal route matching
  if (options.proxy && sharedDb) {
    const proxyEngine = new ProxyEngine(sharedDb, {
      logger: appLogger.child("proxy"),
      pluginManager: sharedPluginManager,
    });

    // Create a handler that integrates with Hono
    app.all("*", async (c: Context) => {
      // Skip if already handled by admin or ui routes
      const path = c.req.path;
      if (
        path === "/admin" ||
        path.startsWith("/admin/") ||
        path === "/ui" ||
        path.startsWith("/ui/")
      ) {
        return c.notFound();
      }

      // Try to handle with proxy engine
      const result = await proxyEngine.handle(c);

      if (result) {
        // Proxy handled the request
        return result;
      }

      appLogger.debug("Unified server returned 404 for unmatched proxy request", {
        method: c.req.method,
        path: c.req.path,
      });

      // No matching route in proxy engine
      return c.notFound();
    });
  }

  return app;
}

/**
 * Start unified server
 *
 * @param options - Unified server options
 */
export async function startUnifiedServer(options: UnifiedServerOptions): Promise<void> {
  const app = await createUnifiedServer(options);

  const server: ServerType = serve({
    fetch: app.fetch,
    port: options.port,
  });

  // Print banner
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                   MiniGateway                              ║
╠════════════════════════════════════════════════════════════╣
║  Server: http://localhost:${options.port}                          ║
║                                                            ║
║  Endpoints:                                                ║
║    - Web UI:       http://localhost:${options.port}/ui                ║
║    - Admin API:    http://localhost:${options.port}/admin             ║
║    - Proxy:        http://localhost:${options.port}/ (via routes)     ║
╚════════════════════════════════════════════════════════════╝
  `);

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("\nShutting down server...");
    server.close();
    process.exit(0);
  });
}
