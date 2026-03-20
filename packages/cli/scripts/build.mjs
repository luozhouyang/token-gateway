import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { embedWebAssets } from "./embed-web-assets.mjs";

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(packageDir, "../..");
const coreDir = path.join(repoRoot, "packages/core");
const webDir = path.join(repoRoot, "apps/web");

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    shell: process.platform === "win32",
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("vp", ["run", "build"], coreDir);
run("vp", ["build"], webDir);
run("vp", ["pack", "src/cli/index.ts"], packageDir);
embedWebAssets();
