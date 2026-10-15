import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    // Same alias as vite.config.ts, so client modules can be tested.
    alias: { "@shared": path.resolve(import.meta.dirname, "shared") },
  },
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});
