import { defineConfig } from "vite-plus";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

const isTest = process.env.VITEST === "true";

export default defineConfig({
  base: "/ui/",
  resolve: {
    tsconfigPaths: true,
  },
  plugins: isTest
    ? []
    : [
        devtools(),
        nitro({ rollupConfig: { external: [/^@sentry\//] } }),
        tailwindcss(),
        tanstackStart({
          spa: {
            enabled: true,
            prerender: {
              outputPath: "/index.html",
            },
          },
        }),
      ],
  test: {
    environment: "jsdom",
    passWithNoTests: true,
  },
});
