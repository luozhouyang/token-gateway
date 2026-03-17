// Services Admin Commands

import { Command } from "commander";
import { HttpClient } from "../../lib/http-client.js";

export function createServicesCommand(): Command {
  const services = new Command("services");
  services.description("Manage services");

  services
    .command("list")
    .description("List all services")
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
      const response = await client.get(`/services?${params}`);
      console.log(JSON.stringify(response, null, 2));
    });

  services
    .command("get")
    .description("Get a service by ID")
    .argument("<id>", "Service ID")
    .action(async (id) => {
      const client = await HttpClient.create();
      const response = await client.get(`/services/${id}`);
      console.log(JSON.stringify(response, null, 2));
    });

  services
    .command("create")
    .description("Create a new service")
    .requiredOption("-n, --name <name>", "Service name")
    .requiredOption("-u, --url <url>", "Service URL")
    .option("-p, --protocol <protocol>", "Protocol (http/https)")
    .option("-H, --host <host>", "Host")
    .option("-P, --port <port>", "Port")
    .option("--path <path>", "Path")
    .option("--connect-timeout <ms>", "Connect timeout in ms")
    .option("--write-timeout <ms>", "Write timeout in ms")
    .option("--read-timeout <ms>", "Read timeout in ms")
    .option("--retries <number>", "Retries")
    .option("-t, --tags <tags>", "Tags (comma-separated)")
    .action(async (options) => {
      const client = await HttpClient.create();
      const body: Record<string, unknown> = {
        name: options.name,
        url: options.url,
      };
      if (options.protocol) body.protocol = options.protocol;
      if (options.host) body.host = options.host;
      if (options.port) body.port = parseInt(options.port);
      if (options.path) body.path = options.path;
      if (options.connectTimeout) body.connectTimeout = parseInt(options.connectTimeout);
      if (options.writeTimeout) body.writeTimeout = parseInt(options.writeTimeout);
      if (options.readTimeout) body.readTimeout = parseInt(options.readTimeout);
      if (options.retries) body.retries = parseInt(options.retries);
      if (options.tags) body.tags = options.tags.split(",").map((t: string) => t.trim());
      const response = await client.post("/services", body);
      console.log(JSON.stringify(response, null, 2));
    });

  services
    .command("update")
    .description("Update a service")
    .requiredOption("-n, --name <name>", "Service name")
    .option("-u, --url <url>", "Service URL")
    .option("-p, --protocol <protocol>", "Protocol")
    .option("-H, --host <host>", "Host")
    .option("-P, --port <port>", "Port")
    .option("--path <path>", "Path")
    .option("--connect-timeout <ms>", "Connect timeout")
    .option("--write-timeout <ms>", "Write timeout")
    .option("--read-timeout <ms>", "Read timeout")
    .option("--retries <number>", "Retries")
    .option("-t, --tags <tags>", "Tags (comma-separated)")
    .action(async (options) => {
      const client = await HttpClient.create();
      const body: Record<string, unknown> = {};
      if (options.url) body.url = options.url;
      if (options.protocol) body.protocol = options.protocol;
      if (options.host) body.host = options.host;
      if (options.port) body.port = parseInt(options.port);
      if (options.path) body.path = options.path;
      if (options.connectTimeout) body.connectTimeout = parseInt(options.connectTimeout);
      if (options.writeTimeout) body.writeTimeout = parseInt(options.writeTimeout);
      if (options.readTimeout) body.readTimeout = parseInt(options.readTimeout);
      if (options.retries) body.retries = parseInt(options.retries);
      if (options.tags) body.tags = options.tags.split(",").map((t: string) => t.trim());
      const response = await client.put(`/services/${options.name}`, body);
      console.log(JSON.stringify(response, null, 2));
    });

  services
    .command("delete")
    .description("Delete a service")
    .requiredOption("-n, --name <name>", "Service name")
    .action(async (options) => {
      const client = await HttpClient.create();
      const response = await client.delete(`/services/${options.name}`);
      console.log(JSON.stringify(response, null, 2));
    });

  return services;
}
