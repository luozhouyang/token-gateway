import { Command } from "commander";
import { startUnifiedServer, getDatabasePath } from "@token-gateway/core";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

program
  .name("token-gateway")
  .description("Token Gateway - LLM API Proxy with Web UI")
  .version("0.0.1");

program
  .command("start")
  .description("Start the unified server (Proxy + Web UI + Admin API)")
  .option("-p, --port <port>", "Server port", "8080")
  .option("--db <path>", "Database file path")
  .option("--ui-dist <path>", "Web UI dist directory path")
  .option("--no-ui", "Disable Web UI (Admin API only)")
  .action(async (options) => {
    try {
      // Determine database path
      const dbPath = options.db || getDatabasePath();

      // Determine UI dist path
      let uiDistPath: string | undefined;

      if (!options.noUi) {
        // Priority:
        // 1. CLI option --ui-dist
        // 2. Environment variable
        // 3. Embedded in CLI package
        // 4. Development mode (apps/web/dist)

        if (options.uiDist) {
          uiDistPath = options.uiDist;
        } else if (process.env.TOKEN_GATEWAY_UI_DIST) {
          uiDistPath = process.env.TOKEN_GATEWAY_UI_DIST;
        } else {
          // Try embedded path in CLI package
          const embeddedPath = path.join(__dirname, "../../web-dist");
          const devPath = path.join(process.cwd(), "apps/web/dist");

          // Check which path exists
          if (existsSync(embeddedPath)) {
            uiDistPath = embeddedPath;
          } else if (existsSync(devPath)) {
            uiDistPath = devPath;
          } else {
            console.warn("Web UI dist not found. Starting without UI.");
            console.warn("To include UI, build the web app or specify --ui-dist");
          }
        }

        // Verify path exists
        if (uiDistPath && !existsSync(uiDistPath)) {
          console.warn(`Warning: Web UI not found at ${uiDistPath}`);
          console.warn("Starting without Web UI...");
          uiDistPath = undefined;
        } else if (uiDistPath) {
          // Check for index.html
          const indexPath = path.join(uiDistPath, "index.html");
          if (!existsSync(indexPath)) {
            console.warn(`Warning: index.html not found in ${uiDistPath}`);
            uiDistPath = undefined;
          }
        }
      }

      // Start the unified server
      await startUnifiedServer({
        port: parseInt(options.port, 10),
        proxy: {
          databasePath: dbPath,
        },
        staticServer: uiDistPath
          ? {
              staticPath: uiDistPath,
              indexFile: "index.html",
              spaMode: true,
            }
          : undefined,
        enableCors: true,
        enableLogger: true,
        enableCompress: true,
      });
    } catch (error) {
      console.error("Failed to start server:", error);
      process.exit(1);
    }
  });

// Config command
program
  .command("config")
  .description("Show configuration information")
  .option("--init", "Initialize configuration directory")
  .action(async (options) => {
    const dbPath = getDatabasePath();

    console.log("Configuration:");
    console.log(`  Database path: ${dbPath}`);

    if (options.init) {
      console.log("\nInitializing configuration...");
    }
  });

program.parse();
