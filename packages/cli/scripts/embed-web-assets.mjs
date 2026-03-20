import { cpSync, existsSync, mkdirSync, rmSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

function getPackageDir() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

function getRepoRoot(packageDir) {
  return path.resolve(packageDir, "../..");
}

function getCandidateWebDirs(repoRoot) {
  return [
    path.join(repoRoot, "apps/web/.output/public"),
    path.join(repoRoot, "apps/web/dist"),
    path.join(repoRoot, "apps/web/dist/client"),
  ];
}

function findBuiltWebDir(repoRoot) {
  for (const candidate of getCandidateWebDirs(repoRoot)) {
    if (existsSync(path.join(candidate, "index.html"))) {
      return candidate;
    }
  }

  return null;
}

export function embedWebAssets() {
  const packageDir = getPackageDir();
  const repoRoot = getRepoRoot(packageDir);
  const sourceDir = findBuiltWebDir(repoRoot);
  const targetDir = path.join(packageDir, "dist/web");

  if (!sourceDir) {
    const candidates = getCandidateWebDirs(repoRoot)
      .map((candidate) => `- ${candidate}`)
      .join("\n");

    throw new Error(
      `Built web assets were not found.\nSearched:\n${candidates}\nRun the web build before packaging the CLI.`,
    );
  }

  rmSync(targetDir, { force: true, recursive: true });
  mkdirSync(path.dirname(targetDir), { recursive: true });
  cpSync(sourceDir, targetDir, { recursive: true });

  console.log(`Embedded web assets from ${sourceDir} into ${targetDir}`);
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : "";

if (invokedFile === currentFile) {
  try {
    embedWebAssets();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  }
}
