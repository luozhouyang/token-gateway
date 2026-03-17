// Plugins Admin Commands

import { Command } from "commander";
import { HttpClient } from "../../lib/http-client.js";

export function createPluginsCommand(): Command {
  const plugins = new Command("plugins");
  plugins.description("Manage plugins");

  plugins
    .command("list")
    .description("List all plugins")
    .option("-l, --limit <number>", "Limit results", "20")
    .option("-o, --offset <number>", "Offset results", "0")
    .option("-n, --name <name>", "Filter by name")
    .action(async (options) => {
      const client = await HttpClient.create();
      const params = new URLSearchParams({
        limit: options.limit,
        offset: options.offset,
      });
      if (options.name) params.set("name", options.name);
      const response = await client.get(`/plugins?${params}`);
      console.log(JSON.stringify(response, null, 2));
    });

  plugins
    .command("get")
    .description("Get a plugin by ID")
    .argument("<id>", "Plugin ID")
    .action(async (id) => {
      const client = await HttpClient.create();
      const response = await client.get(`/plugins/${id}`);
      console.log(JSON.stringify(response, null, 2));
    });

  plugins
    .command("create")
    .description("Create a new plugin binding")
    .requiredOption("-n, --name <name>", "Plugin name")
    .option("-s, --service-id <id>", "Service ID")
    .option("-r, --route-id <id>", "Route ID")
    .option("-c, --consumer-id <id>", "Consumer ID")
    .option("--config <json>", "Plugin config (JSON string)")
    .option("--enabled <boolean>", "Enabled", "true")
    .option("-t, --tags <tags>", "Tags (comma-separated)")
    .action(async (options) => {
      const client = await HttpClient.create();
      const body: Record<string, unknown> = {
        name: options.name,
        enabled: options.enabled === "true",
      };
      if (options.serviceId) body.serviceId = options.serviceId;
      if (options.routeId) body.routeId = options.routeId;
      if (options.consumerId) body.consumerId = options.consumerId;
      if (options.config) {
        try {
          body.config = JSON.parse(options.config);
        } catch {
          console.error("Invalid JSON for config");
          process.exit(1);
        }
      }
      if (options.tags) body.tags = options.tags.split(",").map((t: string) => t.trim());
      const response = await client.post("/plugins", body);
      console.log(JSON.stringify(response, null, 2));
    });

  plugins
    .command("update")
    .description("Update a plugin")
    .requiredOption("-n, --name <name>", "Plugin name")
    .option("-s, --service-id <id>", "Service ID")
    .option("-r, --route-id <id>", "Route ID")
    .option("-c, --consumer-id <id>", "Consumer ID")
    .option("--config <json>", "Plugin config (JSON string)")
    .option("--enabled <boolean>", "Enabled")
    .option("-t, --tags <tags>", "Tags (comma-separated)")
    .action(async (options) => {
      const client = await HttpClient.create();
      const body: Record<string, unknown> = {};
      if (options.serviceId) body.serviceId = options.serviceId;
      if (options.routeId) body.routeId = options.routeId;
      if (options.consumerId) body.consumerId = options.consumerId;
      if (options.enabled !== undefined) body.enabled = options.enabled === "true";
      if (options.tags) body.tags = options.tags.split(",").map((t: string) => t.trim());
      if (options.config) {
        try {
          body.config = JSON.parse(options.config);
        } catch {
          console.error("Invalid JSON for config");
          process.exit(1);
        }
      }
      const response = await client.put(`/plugins/${options.name}`, body);
      console.log(JSON.stringify(response, null, 2));
    });

  plugins
    .command("delete")
    .description("Delete a plugin")
    .requiredOption("-n, --name <name>", "Plugin name")
    .action(async (options) => {
      const client = await HttpClient.create();
      const response = await client.delete(`/plugins/${options.name}`);
      console.log(JSON.stringify(response, null, 2));
    });

  return plugins;
}
