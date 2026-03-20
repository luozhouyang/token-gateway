import { defineConfig } from "vite-plus/test/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths({ projects: ["./tsconfig.json"] })],
  test: {
    environment: "jsdom",
    passWithNoTests: true,
  },
});
