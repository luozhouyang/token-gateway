import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "node ./scripts/run-staged-check.mjs",
  },
  lint: { options: { typeAware: true, typeCheck: true } },
});
