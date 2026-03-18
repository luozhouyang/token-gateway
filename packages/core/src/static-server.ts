import { Hono } from "hono";
import { readFileSync, existsSync } from "fs";
import path from "path";

/**
 * Static server options
 */
export interface StaticServerOptions {
  /** Path to static files directory */
  staticPath: string;
  /** Default index file (default: index.html) */
  indexFile?: string;
  /** Enable SPA mode - return index.html for non-file paths (default: true) */
  spaMode?: boolean;
}

/**
 * MIME type mapping for common file extensions
 */
const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".map": "application/json",
};

/**
 * Get MIME type for a file path
 */
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

/**
 * Check if path is a file request (has extension)
 */
function isFileRequest(pathStr: string): boolean {
  // Remove query string and hash
  const cleanPath = pathStr.split("?")[0].split("#")[0];
  // Check if has extension (e.g., .js, .css)
  return /\.[^./]+$/.test(cleanPath);
}

/**
 * Create a static file server
 *
 * @param options - Static server options
 * @returns Hono app that serves static files
 */
export function createStaticServer(options: StaticServerOptions): Hono {
  const { staticPath, indexFile = "index.html", spaMode = true } = options;

  const app = new Hono();

  // Normalize static path
  const normalizedStaticPath = path.resolve(staticPath);

  // GET /* - Serve static files
  app.get("*", async (c) => {
    const requestPath = c.req.path;

    // Security: prevent directory traversal
    if (requestPath.includes("..") || requestPath.includes("\x00")) {
      return c.text("Forbidden", 403);
    }

    // Determine file path
    let relativePath: string;
    const isFile = isFileRequest(requestPath);

    if (requestPath === "/") {
      // Root path - serve index file
      relativePath = indexFile;
    } else if (isFile) {
      // File request - serve as-is
      relativePath = requestPath.slice(1); // Remove leading /
    } else if (spaMode) {
      // Directory-like path in SPA mode - serve index.html
      relativePath = indexFile;
    } else {
      // Non-SPA mode - try to serve the path as a file/directory
      relativePath = requestPath.slice(1);
    }

    // Construct full file path
    const fullPath = path.join(normalizedStaticPath, relativePath);

    // Security check: ensure file is within static directory
    if (!fullPath.startsWith(normalizedStaticPath)) {
      return c.text("Forbidden", 403);
    }

    // Check if file exists and is a file (not directory)
    if (!existsSync(fullPath) || !statSync(fullPath).isFile()) {
      // In SPA mode, fall back to index.html
      if (spaMode && relativePath !== indexFile) {
        const indexPath = path.join(normalizedStaticPath, indexFile);
        if (existsSync(indexPath)) {
          try {
            const content = readFileSync(indexPath, "utf-8");
            return c.html(content, 200, {
              "Cache-Control": "no-cache",
            });
          } catch {
            return c.text("Internal Server Error", 500);
          }
        }
      }
      return c.notFound();
    }

    // Read and serve file
    try {
      const content = readFileSync(fullPath);
      const mimeType = getMimeType(fullPath);

      // Set cache headers based on file type
      const cacheControl =
        mimeType === "text/html" ? "no-cache" : "public, max-age=31536000, immutable";

      return c.body(content, {
        headers: {
          "Content-Type": mimeType,
          "Cache-Control": cacheControl,
        },
      });
    } catch {
      return c.text("Internal Server Error", 500);
    }
  });

  return app;
}

// Helper function for statSync
import { statSync } from "fs";
