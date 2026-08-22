import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    environment: "node",
    passWithNoTests: true,
    setupFiles: ["dotenv/config"],
    // Integration tests share one physical Postgres test database with no per-file
    // isolation (no per-test transactions/schemas) — concurrent files' beforeEach
    // truncations race against each other otherwise.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
});
