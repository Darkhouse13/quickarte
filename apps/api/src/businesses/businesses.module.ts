import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { BusinessesSetupController } from "./businesses-setup.controller";
import { BusinessesSetupService } from "./businesses-setup.service";
import { BusinessesController } from "./businesses.controller";
import { BusinessesService } from "./businesses.service";

@Module({
  imports: [DatabaseModule],
  controllers: [BusinessesController, BusinessesSetupController],
  providers: [BusinessesService, BusinessesSetupService],
  exports: [BusinessesService, BusinessesSetupService],
})
export class BusinessesModule {}
