import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import { createServer, type Server } from "node:http";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { DatabaseService } from "./storage/database.js";
import { runMigrations } from "./storage/migrations.js";
import { createUnifiedServer } from "./unified-server.js";

describe("unified-server", () => {
  let tempDir: string;
  let dbPath: string;
  let db: DatabaseService;
  let uiDir: string;
  let upstreamServer: Server;
  let upstreamPort: number;

  beforeEach(async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), "token-gateway-unified-server-test-"));
    dbPath = path.join(tempDir, "test.db");
    runMigrations(dbPath);
    db = new DatabaseService(dbPath);

    uiDir = path.join(tempDir, "ui");
    mkdirSync(uiDir, { recursive: true });
    writeFileSync(
      path.join(uiDir, "index.html"),
      "<!doctype html><html><body>Token Gateway E2E</body></html>",
      "utf-8",
    );

    upstreamServer = createServer(async (request, response) => {
      const body = await readRequestBody(request);

      response.statusCode = 200;
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          method: request.method,
          url: request.url,
          headers: request.headers,
          body,
        }),
      );
    });

    await new Promise<void>((resolve) => {
      upstreamServer.listen(0, "127.0.0.1", () => resolve());
    });

    upstreamPort = (upstreamServer.address() as AddressInfo).port;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      upstreamServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    db.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("serves the web UI and proxies requests configured through the admin API", async () => {
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
    expect(await uiResponse.text()).toContain("Token Gateway E2E");

    const serviceResponse = await app.request("/admin/services", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "httpbin",
        url: `http://127.0.0.1:${upstreamPort}`,
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
    expect(proxiedResponse.headers.get("access-control-allow-origin")).toBe("*");

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

async function readRequestBody(request: Parameters<Server["emit"]>[1]): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf-8");
}
