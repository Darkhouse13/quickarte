import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { LoggerModule } from "nestjs-pino";
import { randomUUID } from "node:crypto";
import { AuditLogModule } from "./audit-log/audit-log.module";
import { AuthModule } from "./auth/auth.module";
import { BranchesModule } from "./branches/branches.module";
import { BusinessesModule } from "./businesses/businesses.module";
import { TenantContextMiddleware } from "./common/middleware/tenant-context.middleware";
import { validateEnv } from "./config/env";
import { HealthModule } from "./health/health.module";
import { MenuCatalogModule } from "./menu-catalog/menu-catalog.module";
import { OperatingHoursModule } from "./operating-hours/operating-hours.module";
import { PaymentMethodsModule } from "./payment-methods/payment-methods.module";
import { PrintersModule } from "./printers/printers.module";
import { ReceiptSettingsModule } from "./receipt-settings/receipt-settings.module";
import { SyncModule } from "./sync/sync.module";
import { TaxConfigModule } from "./tax-config/tax-config.module";

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
    AuthModule,
    AuditLogModule,
    BusinessesModule,
    BranchesModule,
    OperatingHoursModule,
    PaymentMethodsModule,
    PrintersModule,
    ReceiptSettingsModule,
    TaxConfigModule,
    SyncModule,
    MenuCatalogModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantContextMiddleware).forRoutes("{*path}");
  }
}
