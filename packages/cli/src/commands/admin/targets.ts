// Targets Admin Commands

import { Command } from "commander";
import { HttpClient } from "../../lib/http-client.js";

export function createTargetsCommand(): Command {
  const targets = new Command("targets");
  targets.description("Manage upstream targets");

  targets
    .command("list")
    .description("List targets for an upstream")
    .requiredOption("-u, --upstream-id <id>", "Upstream ID")
    .option("-l, --limit <number>", "Limit results", "20")
    .option("-o, --offset <number>", "Offset results", "0")
    .action(async (options) => {
      const client = await HttpClient.create();
      const params = new URLSearchParams({
        limit: options.limit,
        offset: options.offset,
      });
      const response = await client.get(`/upstreams/${options.upstreamId}/targets?${params}`);
      console.log(JSON.stringify(response, null, 2));
    });

  targets
    .command("create")
    .description("Add a target to an upstream")
    .requiredOption("-u, --upstream-id <id>", "Upstream ID")
    .requiredOption("-t, --target <target>", "Target (host:port)")
    .option("-w, --weight <weight>", "Weight", "100")
    .action(async (options) => {
      const client = await HttpClient.create();
      const body = {
        target: options.target,
        weight: parseInt(options.weight),
      };
      const response = await client.post(`/upstreams/${options.upstreamId}/targets`, body);
      console.log(JSON.stringify(response, null, 2));
    });

  targets
    .command("update")
    .description("Update a target")
    .requiredOption("-u, --upstream-id <id>", "Upstream ID")
    .requiredOption("-t, --target-id <id>", "Target ID")
    .option("-w, --weight <weight>", "Weight")
    .action(async (options) => {
      const client = await HttpClient.create();
      const body: Record<string, unknown> = {};
      if (options.weight) body.weight = parseInt(options.weight);
      const response = await client.put(
        `/upstreams/${options.upstreamId}/targets/${options.targetId}`,
        body,
      );
      console.log(JSON.stringify(response, null, 2));
    });

  targets
    .command("delete")
    .description("Delete a target")
    .requiredOption("-u, --upstream-id <id>", "Upstream ID")
    .requiredOption("-t, --target-id <id>", "Target ID")
    .action(async (options) => {
      const client = await HttpClient.create();
      const response = await client.delete(
        `/upstreams/${options.upstreamId}/targets/${options.targetId}`,
      );
      console.log(JSON.stringify(response, null, 2));
    });

  return targets;
}
