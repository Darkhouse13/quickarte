import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { MenuCatalogController } from "./menu-catalog.controller";
import { MenuCatalogService } from "./menu-catalog.service";

@Module({
  imports: [DatabaseModule],
  controllers: [MenuCatalogController],
  providers: [MenuCatalogService],
  exports: [MenuCatalogService],
})
export class MenuCatalogModule {}
