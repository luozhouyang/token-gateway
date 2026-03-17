// Admin API CLI Commands

import { Command } from "commander";
import { createServicesCommand } from "./services.js";
import { createRoutesCommand } from "./routes.js";
import { createUpstreamsCommand } from "./upstreams.js";
import { createTargetsCommand } from "./targets.js";
import { createConsumersCommand } from "./consumers.js";
import { createPluginsCommand } from "./plugins.js";

export function createAdminCommand(): Command {
  const admin = new Command("admin");
  admin.description("Manage gateway resources via Admin API");

  // Add resource subcommands
  admin.addCommand(createServicesCommand());
  admin.addCommand(createRoutesCommand());
  admin.addCommand(createUpstreamsCommand());
  admin.addCommand(createTargetsCommand());
  admin.addCommand(createConsumersCommand());
  admin.addCommand(createPluginsCommand());

  return admin;
}
