import { Module } from "@nestjs/common";
import { AuditLogModule } from "../audit-log/audit-log.module";
import { DatabaseModule } from "../database/database.module";
import { SyncController } from "./sync.controller";
import { SyncService } from "./sync.service";

@Module({
  imports: [AuditLogModule, DatabaseModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
