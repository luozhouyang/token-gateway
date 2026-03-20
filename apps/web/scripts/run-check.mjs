import { readdirSync, statSync } from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(packageDir, "../..");
const vpBin = path.join(repoRoot, "node_modules/.bin/vp");
const excludedRelativePaths = new Set(["src/routeTree.gen.ts"]);

function collectFiles(currentDir) {
  const entries = readdirSync(currentDir, { withFileTypes: true });
  const collectedFiles = [];

  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);
    const relativePath = path.relative(packageDir, absolutePath);

    if (excludedRelativePaths.has(relativePath)) {
      continue;
    }

    if (entry.isDirectory()) {
      collectedFiles.push(...collectFiles(absolutePath));
      continue;
    }

    if (!statSync(absolutePath).isFile()) {
      continue;
    }

    collectedFiles.push(relativePath);
  }

  return collectedFiles;
}

const filesToCheck = [
  "package.json",
  "tsconfig.json",
  "vite.config.ts",
  "vitest.config.ts",
  ...collectFiles(path.join(packageDir, "src")),
];

const result = spawnSync(vpBin, ["check", ...filesToCheck], {
  cwd: packageDir,
  stdio: "inherit",
});

if (result.error) {
  throw result.error;
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
