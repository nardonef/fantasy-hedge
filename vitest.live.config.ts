import { defineConfig } from "vitest/config";

// Real-network vendor contract tests, run only via `pnpm test:live` — never in the default
// `pnpm test` run or CI. See vitest.config.ts, which excludes these by default.
export default defineConfig({
  test: {
    include: ["src/**/*.live.test.ts"],
    environment: "node",
    passWithNoTests: true,
    setupFiles: ["dotenv/config"],
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
});
