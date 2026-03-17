// Test utilities for CLI tests

import { Command } from "commander";

/**
 * Capture console.log output during test execution
 */
export function captureConsoleOutput(): {
  output: string[];
  startCapture: () => void;
  stopCapture: () => void;
  getOutput: () => string;
} {
  const output: string[] = [];
  const originalLog = console.log;

  return {
    output,
    startCapture: () => {
      console.log = (...args: unknown[]) => {
        output.push(args.join(" "));
      };
    },
    stopCapture: () => {
      console.log = originalLog;
    },
    getOutput: () => output.join("\n"),
  };
}

/**
 * Execute a commander command with given arguments
 */
export async function executeCommand(
  command: Command,
  args: string[],
): Promise<{ exitCode: number; output: string; error?: string }> {
  const { startCapture, stopCapture, getOutput } = captureConsoleOutput();
  let error: string | undefined;

  startCapture();

  try {
    // Parse arguments and execute - use "node" and command name as first two args
    await command.parseAsync(["node", command.name(), ...args], { from: "user" });
    return { exitCode: 0, output: getOutput() };
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    return { exitCode: 1, output: getOutput(), error };
  } finally {
    stopCapture();
  }
}
