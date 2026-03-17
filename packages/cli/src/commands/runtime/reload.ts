// Reload command - Reload configuration without restart

import { Command } from "commander";
import { promises as fs } from "fs";
import { join } from "path";

const PID_FILE = join(process.cwd(), ".proxy-engine.pid");

export function createReloadCommand(): Command {
  return new Command("reload")
    .description("Reload configuration without restart")
    .action(async () => {
      try {
        // Check if PID file exists
        try {
          await fs.access(PID_FILE);
        } catch {
          console.log("Proxy engine is not running (no PID file found).");
          return;
        }

        // Read PID
        const pidContent = await fs.readFile(PID_FILE, "utf-8");
        const pid = parseInt(pidContent.trim(), 10);

        // Check if process is running
        try {
          process.kill(pid, 0);
        } catch {
          console.log("Proxy engine is not running (stale PID file).");
          await fs.unlink(PID_FILE);
          return;
        }

        // Send SIGHUP for reload
        process.kill(pid, "SIGHUP");
        console.log(`✓ Sent reload signal to proxy engine (PID: ${pid})`);
      } catch (error) {
        console.error("Error reloading configuration:", error);
        process.exit(1);
      }
    });
}
