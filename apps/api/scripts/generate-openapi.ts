import "reflect-metadata";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import { createOpenApiDocument } from "../src/openapi";

const outputPath = resolve(process.cwd(), "../../packages/shared-types/openapi.json");

async function main() {
  process.stdout.write("Preparing OpenAPI generation environment\n");
  process.env.API_PORT ??= "3001";
  process.env.DATABASE_URL ??=
    "postgres://openapi:openapi@localhost:5432/openapi";
  process.env.LOG_LEVEL ??= "silent";
  process.env.NODE_ENV ??= "development";

  process.stdout.write("Creating Nest application context\n");
  const { AppModule } = await import("../src/app.module");
  const app = await NestFactory.create(AppModule, {
    logger: ["error"],
  });

  app.setGlobalPrefix("v1");
  process.stdout.write("Initializing Nest application\n");
  await app.init();

  const document = createOpenApiDocument(app);
  await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`);
  await app.close();

  process.stdout.write(`OpenAPI document written to ${outputPath}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
