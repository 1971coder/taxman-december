import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/__tests__/**/*.test.ts"],
    restoreMocks: true,
    clearMocks: true,
    unstubGlobals: true,
    threads: false,
    watch: false
  }
});
