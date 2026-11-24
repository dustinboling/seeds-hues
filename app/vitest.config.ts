import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    setupFiles: ["tests/setup.ts"],
    testTimeout: 60_000,
    // The build test shells out to `npm run build`; keep files sequential
    // to avoid CPU contention (same discipline as v2's D1-backed suites).
    fileParallelism: false,
  },
});
