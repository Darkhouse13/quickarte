import { Module } from "@nestjs/common";
import { RateLimitService } from "../auth/rate-limit.service";
import { DatabaseModule } from "../database/database.module";
import { AuditLogController } from "./audit-log.controller";
import { AuditLogService } from "./audit-log.service";

@Module({
  imports: [DatabaseModule],
  controllers: [AuditLogController],
  providers: [AuditLogService, RateLimitService],
  exports: [AuditLogService],
})
export class AuditLogModule {}
