import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { OperatingHoursController } from "./operating-hours.controller";
import { OperatingHoursService } from "./operating-hours.service";

@Module({
  imports: [DatabaseModule],
  controllers: [OperatingHoursController],
  providers: [OperatingHoursService],
  exports: [OperatingHoursService],
})
export class OperatingHoursModule {}
