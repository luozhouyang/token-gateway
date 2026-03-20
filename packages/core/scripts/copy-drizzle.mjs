import { cpSync, mkdirSync, rmSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(packageDir, "drizzle");
const targetDir = path.join(packageDir, "dist/drizzle");

rmSync(targetDir, { force: true, recursive: true });
mkdirSync(path.dirname(targetDir), { recursive: true });
cpSync(sourceDir, targetDir, { recursive: true });
