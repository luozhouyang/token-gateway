import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import { Hono } from "hono";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createStaticServer } from "./static-server.js";

describe("static-server", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), "token-gateway-static-server-"));
    mkdirSync(path.join(tempDir, "assets"), { recursive: true });
    writeFileSync(path.join(tempDir, "index.html"), "<html><body>index</body></html>");
    writeFileSync(path.join(tempDir, "assets", "styles.css"), "body { color: red; }");
  });

  afterEach(() => {
    rmSync(tempDir, { force: true, recursive: true });
  });

  test("serves asset files correctly when mounted under /ui", async () => {
    const app = new Hono();
    app.route(
      "/ui",
      createStaticServer({
        staticPath: tempDir,
        spaMode: true,
        urlPrefix: "/ui",
      }),
    );

    const response = await app.request("/ui/assets/styles.css");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/css");
    expect(await response.text()).toContain("color: red");
  });

  test("falls back to index.html for SPA routes when mounted under /ui", async () => {
    const app = new Hono();
    app.route(
      "/ui",
      createStaticServer({
        staticPath: tempDir,
        spaMode: true,
        urlPrefix: "/ui",
      }),
    );

    const response = await app.request("/ui/dashboard");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toContain("<body>index</body>");
  });
});
