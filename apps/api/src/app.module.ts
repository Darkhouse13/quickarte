import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { LoggerModule } from "nestjs-pino";
import { randomUUID } from "node:crypto";
import { AuditLogModule } from "./audit-log/audit-log.module";
import { BusinessesModule } from "./businesses/businesses.module";
import { TenantContextMiddleware } from "./common/middleware/tenant-context.middleware";
import { validateEnv } from "./config/env";
import { HealthModule } from "./health/health.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const nodeEnv = configService.get<string>("NODE_ENV");
        const isProduction = nodeEnv === "production";

        return {
          pinoHttp: {
            level: configService.get<string>("LOG_LEVEL", "info"),
            genReqId: (request) => {
              const header = request.headers["x-request-id"];
              const requestId = Array.isArray(header) ? header[0] : header;
              return requestId ? String(requestId) : randomUUID();
            },
            customProps: (request) => ({
              request_id: request.id,
            }),
            redact: [
              "req.headers.authorization",
              "req.headers.cookie",
              "res.headers.set-cookie",
              "password",
              "pin",
              "token",
              "authorization",
              "cookie",
            ],
            transport: isProduction
              ? undefined
              : {
                  target: "pino-pretty",
                  options: {
                    colorize: true,
                    singleLine: true,
                    translateTime: "SYS:standard",
                  },
                },
          },
        };
      },
    }),
    HealthModule,
    AuditLogModule,
    BusinessesModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantContextMiddleware).forRoutes("{*path}");
  }
}
