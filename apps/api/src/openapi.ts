import { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

export function createOpenApiDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle("Quickarte API")
    .setVersion("0.1.0")
    .setOpenAPIVersion("3.1.0")
    .addServer("http://localhost:3001/v1")
    .build();

  return SwaggerModule.createDocument(app, config);
}

export function setupOpenApi(app: INestApplication): void {
  const document = createOpenApiDocument(app);
  SwaggerModule.setup("v1/docs", app, document, {
    jsonDocumentUrl: "v1/docs-json",
  });
}
