import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
    clearMocks: true,
    restoreMocks: true,
    pool: "threads",
    maxWorkers: 1,
    fileParallelism: false,
    testTimeout: 15_000,
  },
});
