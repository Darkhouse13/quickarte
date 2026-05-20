import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { TaxConfigController } from "./tax-config.controller";
import { TaxConfigService } from "./tax-config.service";

@Module({
  imports: [DatabaseModule],
  controllers: [TaxConfigController],
  providers: [TaxConfigService],
  exports: [TaxConfigService],
})
export class TaxConfigModule {}
