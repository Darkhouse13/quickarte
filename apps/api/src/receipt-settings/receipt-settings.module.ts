import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { ReceiptSettingsController } from "./receipt-settings.controller";
import { ReceiptSettingsService } from "./receipt-settings.service";

@Module({
  imports: [DatabaseModule],
  controllers: [ReceiptSettingsController],
  providers: [ReceiptSettingsService],
  exports: [ReceiptSettingsService],
})
export class ReceiptSettingsModule {}
