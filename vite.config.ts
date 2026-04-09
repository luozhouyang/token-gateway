import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    ignorePatterns: ["**/dist", "**/.output", "**/.nitro", "**/vite.config.ts", "**/drizzle.config.ts", "**/routeTree.gen.ts"],
  },
  staged: {
    "*": "vp check --fix",
  },
  lint: {
    ignorePatterns: ["**/dist", "**/.output", "**/.nitro", "**/routeTree.gen.ts"],
    options: { typeAware: true, typeCheck: true },
  },
  test: {
    environment: "node",
  },
});
