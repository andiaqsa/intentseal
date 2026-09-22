import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["server/**/*.test.ts"],
    clearMocks: true,
    restoreMocks: true,
    pool: "threads",
    maxWorkers: 1,
    fileParallelism: false,
    testTimeout: 10_000,
  },
});
