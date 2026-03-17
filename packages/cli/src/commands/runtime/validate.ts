// Validate command - Validate configuration file

import { Command } from "commander";
import { promises as fs } from "fs";
import { join } from "path";
import * as yaml from "js-yaml";

interface ConfigSchema {
  server?: {
    host?: string;
    port?: number;
  };
  database?: {
    path?: string;
  };
  admin?: {
    enabled?: boolean;
    basePath?: string;
  };
  proxy?: {
    timeout?: number;
    preserveHost?: boolean;
    stripPath?: boolean;
  };
  logging?: {
    level?: string;
    format?: string;
  };
  upstreams?: Array<{
    name: string;
    algorithm?: string;
    targets?: Array<{
      target: string;
      weight?: number;
    }>;
  }>;
  routes?: Array<{
    name: string;
    paths?: string[];
    upstream?: string;
  }>;
  plugins?: Array<{
    name: string;
    enabled?: boolean;
    config?: Record<string, unknown>;
  }>;
}

const validLogLevels = ["debug", "info", "warn", "error"];
const validLogFormats = ["json", "pretty"];
const validAlgorithms = ["round-robin", "least-connections", "ip-hash", "random"];

export function createValidateCommand(): Command {
  return new Command("validate")
    .description("Validate configuration file")
    .option("-c, --config <path>", "Config file path", "./proxy.config.yaml")
    .action(async (options) => {
      const configPath = join(process.cwd(), options.config);

      try {
        // Check if file exists
        await fs.access(configPath);
      } catch {
        console.error(`Error: Config file not found: ${configPath}`);
        process.exit(1);
      }

      try {
        // Read and parse YAML
        const content = await fs.readFile(configPath, "utf-8");
        const config = yaml.load(content) as ConfigSchema;

        const errors: string[] = [];
        const warnings: string[] = [];

        // Validate server section
        if (config.server) {
          if (config.server.port !== undefined) {
            if (
              typeof config.server.port !== "number" ||
              config.server.port < 1 ||
              config.server.port > 65535
            ) {
              errors.push("server.port must be a number between 1 and 65535");
            }
          }
          if (config.server.host !== undefined && typeof config.server.host !== "string") {
            errors.push("server.host must be a string");
          }
        }

        // Validate database section
        if (config.database) {
          if (config.database.path !== undefined && typeof config.database.path !== "string") {
            errors.push("database.path must be a string");
          }
        }

        // Validate admin section
        if (config.admin) {
          if (config.admin.enabled !== undefined && typeof config.admin.enabled !== "boolean") {
            errors.push("admin.enabled must be a boolean");
          }
          if (config.admin.basePath !== undefined && typeof config.admin.basePath !== "string") {
            errors.push("admin.basePath must be a string");
          }
        }

        // Validate proxy section
        if (config.proxy) {
          if (config.proxy.timeout !== undefined) {
            if (typeof config.proxy.timeout !== "number" || config.proxy.timeout < 0) {
              errors.push("proxy.timeout must be a positive number");
            }
          }
          if (
            config.proxy.preserveHost !== undefined &&
            typeof config.proxy.preserveHost !== "boolean"
          ) {
            errors.push("proxy.preserveHost must be a boolean");
          }
          if (config.proxy.stripPath !== undefined && typeof config.proxy.stripPath !== "boolean") {
            errors.push("proxy.stripPath must be a boolean");
          }
        }

        // Validate logging section
        if (config.logging) {
          if (
            config.logging.level !== undefined &&
            !validLogLevels.includes(config.logging.level)
          ) {
            errors.push(`logging.level must be one of: ${validLogLevels.join(", ")}`);
          }
          if (
            config.logging.format !== undefined &&
            !validLogFormats.includes(config.logging.format)
          ) {
            errors.push(`logging.format must be one of: ${validLogFormats.join(", ")}`);
          }
        }

        // Validate upstreams
        if (config.upstreams) {
          config.upstreams.forEach((upstream, index) => {
            if (!upstream.name) {
              errors.push(`upstreams[${index}]: missing required field 'name'`);
            }
            if (upstream.algorithm && !validAlgorithms.includes(upstream.algorithm)) {
              errors.push(
                `upstreams[${index}]: invalid algorithm '${upstream.algorithm}'. Must be one of: ${validAlgorithms.join(", ")}`,
              );
            }
            if (upstream.targets) {
              upstream.targets.forEach((target, targetIndex) => {
                if (!target.target) {
                  errors.push(
                    `upstreams[${index}].targets[${targetIndex}]: missing required field 'target'`,
                  );
                }
                if (
                  target.weight !== undefined &&
                  (typeof target.weight !== "number" || target.weight < 0 || target.weight > 100)
                ) {
                  errors.push(
                    `upstreams[${index}].targets[${targetIndex}]: weight must be between 0 and 100`,
                  );
                }
              });
            }
          });
        }

        // Validate routes
        if (config.routes) {
          const upstreamNames = new Set(config.upstreams?.map((u) => u.name) || []);
          config.routes.forEach((route, index) => {
            if (!route.name) {
              errors.push(`routes[${index}]: missing required field 'name'`);
            }
            if (!route.paths || route.paths.length === 0) {
              errors.push(`routes[${index}]: must have at least one path in 'paths'`);
            }
            if (route.upstream && !upstreamNames.has(route.upstream)) {
              warnings.push(`routes[${index}]: upstream '${route.upstream}' not defined`);
            }
          });
        }

        // Validate plugins
        if (config.plugins) {
          config.plugins.forEach((plugin, index) => {
            if (!plugin.name) {
              errors.push(`plugins[${index}]: missing required field 'name'`);
            }
            if (plugin.enabled !== undefined && typeof plugin.enabled !== "boolean") {
              errors.push(`plugins[${index}]: enabled must be a boolean`);
            }
          });
        }

        // Output results
        if (errors.length === 0 && warnings.length === 0) {
          console.log(`✓ Configuration file is valid: ${configPath}`);
        } else {
          if (errors.length > 0) {
            console.error(`✗ Validation failed with ${errors.length} error(s):`);
            errors.forEach((err) => console.error(`  - ${err}`));
          }

          if (warnings.length > 0) {
            console.warn(`⚠ ${warnings.length} warning(s):`);
            warnings.forEach((warn) => console.warn(`  - ${warn}`));
          }

          if (errors.length > 0) {
            process.exit(1);
          }
        }
      } catch (error) {
        if (error instanceof yaml.YAMLException) {
          console.error(`Error parsing YAML: ${(error as yaml.YAMLException).message}`);
        } else {
          console.error("Error validating config:", error);
        }
        process.exit(1);
      }
    });
}
