// Runtime commands - Start, Stop, Restart, Reload, Status

import { Command } from "commander";
import { createStartCommand } from "./start.js";
import { createStopCommand } from "./stop.js";
import { createRestartCommand } from "./restart.js";
import { createReloadCommand } from "./reload.js";
import { createStatusCommand } from "./status.js";

export function createRuntimeCommands(): Command {
  const runtime = new Command();
  runtime.description("Manage proxy engine runtime");

  runtime.addCommand(createStartCommand());
  runtime.addCommand(createStopCommand());
  runtime.addCommand(createRestartCommand());
  runtime.addCommand(createReloadCommand());
  runtime.addCommand(createStatusCommand());

  return runtime;
}

export { createStartCommand } from "./start.js";
export { createStopCommand } from "./stop.js";
export { createRestartCommand } from "./restart.js";
export { createReloadCommand } from "./reload.js";
export { createStatusCommand } from "./status.js";
