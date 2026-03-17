// Upstreams Admin Commands

import { Command } from "commander";
import { HttpClient } from "../../lib/http-client.js";

export function createUpstreamsCommand(): Command {
  const upstreams = new Command("upstreams");
  upstreams.description("Manage upstreams");

  upstreams
    .command("list")
    .description("List all upstreams")
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
      const response = await client.get(`/upstreams?${params}`);
      console.log(JSON.stringify(response, null, 2));
    });

  upstreams
    .command("get")
    .description("Get an upstream by ID")
    .argument("<id>", "Upstream ID")
    .action(async (id) => {
      const client = await HttpClient.create();
      const response = await client.get(`/upstreams/${id}`);
      console.log(JSON.stringify(response, null, 2));
    });

  upstreams
    .command("create")
    .description("Create a new upstream")
    .requiredOption("-n, --name <name>", "Upstream name")
    .option("-a, --algorithm <algorithm>", "Load balancing algorithm", "round-robin")
    .option("--hash-on <field>", "Hash on field")
    .option("--hash-fallback <field>", "Hash fallback field")
    .option("--slots <number>", "Slots", "10000")
    .option("-t, --tags <tags>", "Tags (comma-separated)")
    .action(async (options) => {
      const client = await HttpClient.create();
      const body: Record<string, unknown> = {
        name: options.name,
        algorithm: options.algorithm,
        slots: parseInt(options.slots),
      };
      if (options.hashOn) body.hashOn = options.hashOn;
      if (options.hashFallback) body.hashFallback = options.hashFallback;
      if (options.tags) body.tags = options.tags.split(",").map((t: string) => t.trim());
      const response = await client.post("/upstreams", body);
      console.log(JSON.stringify(response, null, 2));
    });

  upstreams
    .command("update")
    .description("Update an upstream")
    .requiredOption("-n, --name <name>", "Upstream name")
    .option("-a, --algorithm <algorithm>", "Load balancing algorithm")
    .option("--hash-on <field>", "Hash on field")
    .option("--hash-fallback <field>", "Hash fallback field")
    .option("--slots <number>", "Slots")
    .option("-t, --tags <tags>", "Tags (comma-separated)")
    .action(async (options) => {
      const client = await HttpClient.create();
      const body: Record<string, unknown> = {};
      if (options.algorithm) body.algorithm = options.algorithm;
      if (options.hashOn) body.hashOn = options.hashOn;
      if (options.hashFallback) body.hashFallback = options.hashFallback;
      if (options.slots) body.slots = parseInt(options.slots);
      if (options.tags) body.tags = options.tags.split(",").map((t: string) => t.trim());
      const response = await client.put(`/upstreams/${options.name}`, body);
      console.log(JSON.stringify(response, null, 2));
    });

  upstreams
    .command("delete")
    .description("Delete an upstream")
    .requiredOption("-n, --name <name>", "Upstream name")
    .action(async (options) => {
      const client = await HttpClient.create();
      const response = await client.delete(`/upstreams/${options.name}`);
      console.log(JSON.stringify(response, null, 2));
    });

  return upstreams;
}
