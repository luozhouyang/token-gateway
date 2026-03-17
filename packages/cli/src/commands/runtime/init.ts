// Init command - Initialize a new configuration file

import { Command } from "commander";
import { promises as fs } from "fs";
import { join } from "path";
import { getConfigPath, getDatabasePath } from "@token-gateway/core";

const defaultConfig = `# Token Gateway Configuration
# This file controls how the proxy engine routes and processes requests

# Server configuration
server:
  host: "0.0.0.0"
  port: 8080

# Database configuration
database:
  # SQLite database file path
  # Default: uses user config directory (~/.config/token-gateway/token-gateway.db on Linux)
  path: "${getDatabasePath()}"

# Admin API configuration
admin:
  # Enable/disable admin API
  enabled: true
  # Admin API base path
  basePath: "/admin"

# Proxy settings
proxy:
  # Timeout for upstream requests (in milliseconds)
  timeout: 30000
  # Whether to preserve the original host header
  preserveHost: false
  # Whether to strip matched path prefix when forwarding
  stripPath: true

# Logging configuration
logging:
  # Log level: debug, info, warn, error
  level: "info"
  # Log format: json, pretty
  format: "pretty"

# Example upstream definition
upstreams:
  - name: "api-backend"
    algorithm: "round-robin"
    targets:
      - target: "http://localhost:3000"
        weight: 100

# Example route definition
routes:
  - name: "api-routes"
    paths:
      - "/api"
    upstream: "api-backend"

# Plugins configuration
plugins:
  # CORS plugin
  - name: "cors"
    enabled: true
    config:
      origin: ["*"]
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
      allowedHeaders: ["Content-Type", "Authorization"]

  # Rate limiting plugin
  - name: "rate-limit"
    enabled: false
    config:
      windowMs: 60000  # 1 minute
      maxRequests: 100

  # Key authentication plugin
  - name: "key-auth"
    enabled: false
    config:
      keyNames: ["X-API-Key"]
      hideCredentials: false
`;

export function createInitCommand(): Command {
  return new Command("init")
    .description("Initialize a new configuration file")
    .argument("[path]", "Config file path", getConfigPath())
    .option("-f, --force", "Overwrite existing config file")
    .action(async (path, options) => {
      const configPath = join(process.cwd(), path);

      try {
        // Check if file exists
        try {
          await fs.access(configPath);
          if (!options.force) {
            console.error(`Error: Config file already exists at: ${configPath}`);
            console.error("Use --force to overwrite existing file.");
            process.exit(1);
          }
        } catch {
          // File doesn't exist, continue
        }

        // Write default config
        await fs.writeFile(configPath, defaultConfig, "utf-8");

        console.log(`✓ Created configuration file: ${configPath}`);
        console.log("\nNext steps:");
        console.log(`  1. Edit ${configPath} to configure your gateway`);
        console.log("  2. Run 'proxy-engine validate' to validate the configuration");
        console.log("  3. Run 'proxy-engine start' to start the gateway");
      } catch (error) {
        console.error("Error creating config file:", error);
        process.exit(1);
      }
    });
}
