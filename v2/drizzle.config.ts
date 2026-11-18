import { defineConfig } from "drizzle-kit";

// Generates SQL into migrations/ which Wrangler applies (`wrangler d1 migrations apply DB`).
export default defineConfig({
  dialect: "sqlite",
  schema: "./lib/db/schema.ts",
  out: "./migrations",
});
