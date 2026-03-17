// Stop command - Stop the proxy engine

import { Command } from "commander";
import { promises as fs } from "fs";
import { join } from "path";

const PID_FILE = join(process.cwd(), ".proxy-engine.pid");

export function createStopCommand(): Command {
  return new Command("stop").description("Stop the proxy engine").action(async () => {
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
      const pid = pidContent.trim();

      // Check if process is running
      try {
        process.kill(parseInt(pid, 10), 0);
      } catch {
        console.log("Proxy engine is not running (stale PID file).");
        await fs.unlink(PID_FILE);
        return;
      }

      // Send SIGTERM
      process.kill(parseInt(pid, 10), "SIGTERM");
      console.log(`✓ Stopped proxy engine (PID: ${pid})`);

      // Remove PID file
      await fs.unlink(PID_FILE);
    } catch (error) {
      console.error("Error stopping proxy engine:", error);
      process.exit(1);
    }
  });
}
