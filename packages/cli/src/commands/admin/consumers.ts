// Consumers Admin Commands

import { Command } from "commander";
import { HttpClient } from "../../lib/http-client.js";

export function createConsumersCommand(): Command {
  const consumers = new Command("consumers");
  consumers.description("Manage consumers");

  consumers
    .command("list")
    .description("List all consumers")
    .option("-l, --limit <number>", "Limit results", "20")
    .option("-o, --offset <number>", "Offset results", "0")
    .option("-u, --username <username>", "Filter by username")
    .action(async (options) => {
      const client = await HttpClient.create();
      const params = new URLSearchParams({
        limit: options.limit,
        offset: options.offset,
      });
      if (options.username) params.set("username", options.username);
      const response = await client.get(`/consumers?${params}`);
      console.log(JSON.stringify(response, null, 2));
    });

  consumers
    .command("get")
    .description("Get a consumer by ID")
    .argument("<id>", "Consumer ID")
    .action(async (id) => {
      const client = await HttpClient.create();
      const response = await client.get(`/consumers/${id}`);
      console.log(JSON.stringify(response, null, 2));
    });

  consumers
    .command("create")
    .description("Create a new consumer")
    .option("-u, --username <username>", "Username")
    .option("-c, --custom-id <id>", "Custom ID")
    .option("-t, --tags <tags>", "Tags (comma-separated)")
    .action(async (options) => {
      const client = await HttpClient.create();
      const body: Record<string, unknown> = {};
      if (options.username) body.username = options.username;
      if (options.customId) body.customId = options.customId;
      if (options.tags) body.tags = options.tags.split(",").map((t: string) => t.trim());
      const response = await client.post("/consumers", body);
      console.log(JSON.stringify(response, null, 2));
    });

  consumers
    .command("update")
    .description("Update a consumer")
    .requiredOption("-n, --name <name>", "Consumer name")
    .option("-u, --username <username>", "Username")
    .option("-c, --custom-id <id>", "Custom ID")
    .option("-t, --tags <tags>", "Tags (comma-separated)")
    .action(async (options) => {
      const client = await HttpClient.create();
      const body: Record<string, unknown> = {};
      if (options.username) body.username = options.username;
      if (options.customId) body.customId = options.customId;
      if (options.tags) body.tags = options.tags.split(",").map((t: string) => t.trim());
      const response = await client.put(`/consumers/${options.name}`, body);
      console.log(JSON.stringify(response, null, 2));
    });

  consumers
    .command("delete")
    .description("Delete a consumer")
    .requiredOption("-n, --name <name>", "Consumer name")
    .action(async (options) => {
      const client = await HttpClient.create();
      const response = await client.delete(`/consumers/${options.name}`);
      console.log(JSON.stringify(response, null, 2));
    });

  return consumers;
}
