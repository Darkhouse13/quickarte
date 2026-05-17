import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import type { CorsOptions } from "@nestjs/common/interfaces/external/cors-options.interface";
import helmet from "helmet";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { ProblemDetailsFilter } from "./common/filters/problem-details.filter";
import { setupOpenApi } from "./openapi";

export async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const configService = app.get(ConfigService);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
      },
      frameguard: { action: "deny" },
      referrerPolicy: { policy: "no-referrer" },
    }),
  );
  app.enableCors(buildCorsOptions(configService));
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix("v1");
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new ProblemDetailsFilter());
  setupOpenApi(app);
  app.enableShutdownHooks();

  const port = configService.get<number>("API_PORT", 3001);
  await app.listen(port);
  return app;
}

void bootstrap();

function buildCorsOptions(configService: ConfigService): CorsOptions {
  const tenantRootDomain = configService
    .get<string>("TENANT_ROOT_DOMAIN", "lvh.me")
    .toLowerCase();

  return {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      let hostname: string;
      try {
        hostname = new URL(origin).hostname.toLowerCase();
      } catch {
        callback(null, false);
        return;
      }

      const allowed =
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "::1" ||
        hostname === tenantRootDomain ||
        hostname.endsWith(`.${tenantRootDomain}`);

      callback(null, allowed);
    },
    credentials: false,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Authorization",
      "Content-Type",
      "X-Request-Id",
      "X-Tenant-Id",
      "X-Manager-Pin",
    ],
  };
}
