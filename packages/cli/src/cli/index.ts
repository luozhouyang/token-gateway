#!/usr/bin/env node

import { Command } from "commander";
import { createAdminCommand } from "../commands/admin/index.js";
import { createInitCommand } from "../commands/runtime/init.js";
import { createValidateCommand } from "../commands/runtime/validate.js";
import { createStartCommand } from "../commands/runtime/start.js";
import { createStopCommand } from "../commands/runtime/stop.js";
import { createRestartCommand } from "../commands/runtime/restart.js";
import { createReloadCommand } from "../commands/runtime/reload.js";
import { createStatusCommand } from "../commands/runtime/status.js";

// Package version - using a hardcoded value since bundler has issues with JSON imports
const pkgVersion = "0.0.0";

const program = new Command();

program
  .name("proxy-engine")
  .version(pkgVersion)
  .description("API Proxy Engine CLI - A programmable API gateway");

// Admin API commands
program.addCommand(createAdminCommand());

// Runtime commands
program.addCommand(createStartCommand());
program.addCommand(createStopCommand());
program.addCommand(createRestartCommand());
program.addCommand(createReloadCommand());
program.addCommand(createStatusCommand());

// Configuration commands
program.addCommand(createInitCommand());
program.addCommand(createValidateCommand());

program.parse();
