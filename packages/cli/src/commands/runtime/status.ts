// Status command - Show proxy engine status

import { Command } from "commander";
import { promises as fs } from "fs";
import { join } from "path";

const PID_FILE = join(process.cwd(), ".proxy-engine.pid");

export function createStatusCommand(): Command {
  return new Command("status").description("Show proxy engine status").action(async () => {
    try {
      // Check if PID file exists
      try {
        await fs.access(PID_FILE);
      } catch {
        console.log("Proxy engine: NOT RUNNING");
        console.log("No PID file found. Use 'proxy-engine start' to start.");
        return;
      }

      // Read PID
      const pidContent = await fs.readFile(PID_FILE, "utf-8");
      const pid = parseInt(pidContent.trim(), 10);

      // Check if process is running
      try {
        process.kill(pid, 0);
        console.log("Proxy engine: RUNNING");
        console.log(`  PID: ${pid}`);
        console.log(`  PID file: ${PID_FILE}`);

        // Try to read config path from command line args
        try {
          const procDir = join("/proc", pid.toString());
          await fs.access(procDir);
          // On Linux, we could read /proc/{pid}/cmdline for more details
          // This is optional and platform-specific
        } catch {
          // /proc doesn't exist (not Linux or no access)
        }
      } catch {
        console.log("Proxy engine: NOT RUNNING (stale PID file)");
        console.log("Removing stale PID file...");
        await fs.unlink(PID_FILE);
        return;
      }
    } catch (error) {
      console.error("Error checking status:", error);
      process.exit(1);
    }
  });
}
