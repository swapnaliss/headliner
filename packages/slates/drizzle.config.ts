import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  // Only `db:migrate` connects; `db:generate` never needs a URL. The value is never printed.
  dbCredentials: { url: process.env["DATABASE_URL"] ?? "" },
});
