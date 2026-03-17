// Restart command - Restart the proxy engine

import { Command } from "commander";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import { join } from "path";

const PID_FILE = join(process.cwd(), ".proxy-engine.pid");

export function createRestartCommand(): Command {
  return new Command("restart")
    .description("Restart the proxy engine")
    .option("-c, --config <path>", "Config file path", "./proxy.config.yaml")
    .action(async (options) => {
      const configPath = join(process.cwd(), options.config);

      try {
        // Check if config file exists
        await fs.access(configPath);
      } catch {
        console.error(`Error: Config file not found: ${configPath}`);
        process.exit(1);
      }

      // Stop existing process if running
      try {
        await fs.access(PID_FILE);
        const pidContent = await fs.readFile(PID_FILE, "utf-8");
        const pid = parseInt(pidContent.trim(), 10);

        try {
          process.kill(pid, 0);
          process.kill(pid, "SIGTERM");
          console.log(`Stopping existing process (PID: ${pid})...`);

          // Wait for process to stop
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch {
          console.log("No running process found.");
        }

        await fs.unlink(PID_FILE);
      } catch {
        // PID file doesn't exist or can't be read, continue
      }

      // Start new process
      console.log("Starting proxy engine...");

      const cliPath = join(process.cwd(), "dist/cli/index.js");
      const child = spawn("node", [cliPath, "start", "-c", configPath], {
        detached: true,
        stdio: "ignore",
      });

      // Write PID file
      await fs.writeFile(PID_FILE, child.pid!.toString(), "utf-8");

      console.log(`✓ Proxy engine restarted (PID: ${child.pid})`);
    });
}
