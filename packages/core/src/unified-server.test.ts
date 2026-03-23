import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseService } from "./storage/database.js";
import { runMigrations } from "./storage/migrations.js";
import { createUnifiedServer } from "./unified-server.js";

describe("unified-server", () => {
  let tempDir: string;
  let dbPath: string;
  let db: DatabaseService;
  let uiDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), "minigateway-unified-server-test-"));
    dbPath = path.join(tempDir, "test.db");
    runMigrations(dbPath);
    db = new DatabaseService(dbPath);

    uiDir = path.join(tempDir, "ui");
    mkdirSync(uiDir, { recursive: true });
    writeFileSync(
      path.join(uiDir, "index.html"),
      "<!doctype html><html><body>MiniGateway E2E</body></html>",
      "utf-8",
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    db.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("serves the web UI and proxies requests configured through the admin API", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const request = input instanceof Request ? input : new Request(input);
      const body = await request.text();

      return new Response(
        JSON.stringify({
          method: request.method,
          url: new URL(request.url).pathname + new URL(request.url).search,
          headers: Object.fromEntries(request.headers.entries()),
          body,
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      );
    });

    const app = await createUnifiedServer({
      port: 0,
      adminApi: {
        db,
        enableCors: false,
        enableLogger: false,
      },
      proxy: {
        databasePath: dbPath,
      },
      staticServer: {
        staticPath: uiDir,
        indexFile: "index.html",
        spaMode: true,
      },
      enableCors: false,
      enableLogger: false,
      enableCompress: false,
    });

    const uiResponse = await app.request("/ui/dashboard");

    expect(uiResponse.status).toBe(200);
    expect(uiResponse.headers.get("content-type")).toContain("text/html");
    expect(await uiResponse.text()).toContain("MiniGateway E2E");

    const serviceResponse = await app.request("/admin/services", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "httpbin",
        url: "http://upstream.internal",
      }),
    });

    expect(serviceResponse.status).toBe(201);
    const service = (await serviceResponse.json()).data as { id: string };

    const routeResponse = await app.request("/admin/routes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "httpbin-route",
        serviceId: service.id,
        paths: ["/httpbin"],
        stripPath: true,
      }),
    });

    expect(routeResponse.status).toBe(201);

    const proxiedResponse = await app.request("/httpbin/anything?foo=bar", {
      method: "GET",
      headers: {
        "X-Test-Header": "smoke",
      },
    });

    expect(proxiedResponse.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(proxiedResponse.headers.get("access-control-allow-origin")).toBeNull();

    const proxiedBody = (await proxiedResponse.json()) as {
      method: string;
      url: string;
      headers: Record<string, string>;
    };

    expect(proxiedBody.method).toBe("GET");
    expect(proxiedBody.url).toBe("/anything?foo=bar");
    expect(proxiedBody.headers["x-test-header"]).toBe("smoke");
    expect(proxiedBody.headers["x-gateway-service"]).toBe("httpbin");
    expect(proxiedBody.headers["x-forwarded-host"]).toContain("localhost");
  });
});
