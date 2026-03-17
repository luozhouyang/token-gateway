import { defineConfig } from "vite-plus";

export default defineConfig({
  build: {
    rollupOptions: {
      input: "src/cli/index.ts",
      output: {
        dir: "dist",
        entryFileNames: "cli/index.js",
        format: "esm",
      },
    },
    lib: {
      entry: "src/cli/index.ts",
      formats: ["es"],
    },
    ssr: true,
  },
  ssr: {
    external: ["fs", "path", "url"],
  },
});
