import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts", "tests/contract/**/*.test.ts", "tests/dom/**/*.test.tsx"],
    testTimeout: 60_000,
    hookTimeout: 180_000,
    // Each D1-backed suite boots its own Miniflare; keep files sequential to avoid port/CPU contention.
    fileParallelism: false,
  },
});
