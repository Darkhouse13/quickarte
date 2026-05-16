import fs from "node:fs";
import path from "node:path";

const candidates = [
  path.resolve(process.cwd(), "packages/db-schema/migrations"),
  path.resolve(process.cwd(), "../../packages/db-schema/migrations"),
  typeof __dirname === "undefined"
    ? undefined
    : path.resolve(__dirname, "../migrations"),
].filter((candidate): candidate is string => Boolean(candidate));

export const migrationsFolder =
  candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0]!;
