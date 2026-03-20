import { spawnSync } from "child_process";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vpBin = path.join(repoRoot, "node_modules/.bin/vp");
const stagedFiles = process.argv.slice(2).map((filePath) => filePath.replaceAll("\\", "/"));

function run(command, args, cwd = repoRoot) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function hasStagedFilesIn(prefix) {
  return stagedFiles.some((filePath) => filePath.startsWith(prefix));
}

function getRootFilesToCheck() {
  return stagedFiles.filter((filePath) => {
    if (
      filePath.startsWith("apps/web/") ||
      filePath.startsWith("packages/core/") ||
      filePath.startsWith("packages/cli/")
    ) {
      return false;
    }

    return existsSync(path.join(repoRoot, filePath));
  });
}

if (hasStagedFilesIn("apps/web/")) {
  run(process.execPath, ["./apps/web/scripts/run-check.mjs"]);
}

if (hasStagedFilesIn("packages/core/")) {
  run(process.execPath, ["./packages/core/scripts/run-check.mjs"]);
}

if (hasStagedFilesIn("packages/cli/")) {
  run(process.execPath, ["./packages/cli/scripts/run-check.mjs"]);
}

const rootFilesToCheck = getRootFilesToCheck();

if (rootFilesToCheck.length > 0) {
  run(vpBin, ["check", "--fix", ...rootFilesToCheck]);
}
