// Routes Admin Commands

import { Command } from "commander";
import { HttpClient } from "../../lib/http-client.js";

export function createRoutesCommand(): Command {
  const routes = new Command("routes");
  routes.description("Manage routes");

  routes
    .command("list")
    .description("List all routes")
    .option("-l, --limit <number>", "Limit results", "20")
    .option("-o, --offset <number>", "Offset results", "0")
    .option("-n, --name <name>", "Filter by name")
    .option("-s, --service-id <id>", "Filter by service ID")
    .action(async (options) => {
      const client = await HttpClient.create();
      const params = new URLSearchParams({
        limit: options.limit,
        offset: options.offset,
      });
      if (options.name) params.set("name", options.name);
      if (options.serviceId) params.set("serviceId", options.serviceId);
      const response = await client.get(`/routes?${params}`);
      console.log(JSON.stringify(response, null, 2));
    });

  routes
    .command("get")
    .description("Get a route by ID")
    .argument("<id>", "Route ID")
    .action(async (id) => {
      const client = await HttpClient.create();
      const response = await client.get(`/routes/${id}`);
      console.log(JSON.stringify(response, null, 2));
    });

  routes
    .command("create")
    .description("Create a new route")
    .requiredOption("-n, --name <name>", "Route name")
    .option("-s, --service-id <id>", "Service ID")
    .option("--protocols <protocols>", "Protocols (comma-separated)")
    .option("--methods <methods>", "Methods (comma-separated)")
    .option("--hosts <hosts>", "Hosts (comma-separated)")
    .option("--paths <paths>", "Paths (comma-separated)")
    .option("--strip-path <boolean>", "Strip path", "true")
    .option("--preserve-host <boolean>", "Preserve host", "false")
    .option("-t, --tags <tags>", "Tags (comma-separated)")
    .action(async (options) => {
      const client = await HttpClient.create();
      const body: Record<string, unknown> = {
        name: options.name,
        stripPath: options.stripPath === "true",
        preserveHost: options.preserveHost === "true",
      };
      if (options.serviceId) body.serviceId = options.serviceId;
      if (options.protocols)
        body.protocols = options.protocols.split(",").map((t: string) => t.trim());
      if (options.methods) body.methods = options.methods.split(",").map((t: string) => t.trim());
      if (options.hosts) body.hosts = options.hosts.split(",").map((t: string) => t.trim());
      if (options.paths) body.paths = options.paths.split(",").map((t: string) => t.trim());
      if (options.tags) body.tags = options.tags.split(",").map((t: string) => t.trim());
      const response = await client.post("/routes", body);
      console.log(JSON.stringify(response, null, 2));
    });

  routes
    .command("update")
    .description("Update a route")
    .requiredOption("-n, --name <name>", "Route name")
    .option("-s, --service-id <id>", "Service ID")
    .option("--protocols <protocols>", "Protocols (comma-separated)")
    .option("--methods <methods>", "Methods (comma-separated)")
    .option("--hosts <hosts>", "Hosts (comma-separated)")
    .option("--paths <paths>", "Paths (comma-separated)")
    .option("--strip-path <boolean>", "Strip path")
    .option("--preserve-host <boolean>", "Preserve host")
    .option("-t, --tags <tags>", "Tags (comma-separated)")
    .action(async (options) => {
      const client = await HttpClient.create();
      const body: Record<string, unknown> = {};
      if (options.serviceId) body.serviceId = options.serviceId;
      if (options.protocols)
        body.protocols = options.protocols.split(",").map((t: string) => t.trim());
      if (options.methods) body.methods = options.methods.split(",").map((t: string) => t.trim());
      if (options.hosts) body.hosts = options.hosts.split(",").map((t: string) => t.trim());
      if (options.paths) body.paths = options.paths.split(",").map((t: string) => t.trim());
      if (options.stripPath !== undefined) body.stripPath = options.stripPath === "true";
      if (options.preserveHost !== undefined) body.preserveHost = options.preserveHost === "true";
      if (options.tags) body.tags = options.tags.split(",").map((t: string) => t.trim());
      const response = await client.put(`/routes/${options.name}`, body);
      console.log(JSON.stringify(response, null, 2));
    });

  routes
    .command("delete")
    .description("Delete a route")
    .requiredOption("-n, --name <name>", "Route name")
    .action(async (options) => {
      const client = await HttpClient.create();
      const response = await client.delete(`/routes/${options.name}`);
      console.log(JSON.stringify(response, null, 2));
    });

  return routes;
}
