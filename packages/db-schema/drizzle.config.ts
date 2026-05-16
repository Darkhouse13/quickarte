import type { Config } from "drizzle-kit";
import { config } from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.dirname(fileURLToPath(import.meta.url));

for (const envPath of [
  path.resolve(packageRoot, "../../apps/qr-menu/.env"),
  path.resolve(packageRoot, "../../.env"),
]) {
  if (existsSync(envPath)) {
    config({ path: envPath });
  }
}

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error("DATABASE_URL is not set");
}

export default {
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: { url },
  strict: true,
  verbose: true,
} satisfies Config;
