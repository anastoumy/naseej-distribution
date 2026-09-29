import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup/mockElectron.ts"],
    coverage: {
      provider: "v8",
      include: ["src/main/**/*.ts"],
      exclude: ["src/main/index.ts"],
    },
    alias: {
      "@shared": resolve(__dirname, "src/shared"),
    },
  },
});
