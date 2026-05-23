import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { BranchMenuController } from "./branch-menu.controller";
import { EffectiveMenuResolver } from "./effective-menu.resolver";
import { MenuCatalogController } from "./menu-catalog.controller";
import { MenuCatalogService } from "./menu-catalog.service";
import { MenuImportController } from "./menu-import.controller";
import { MenuImportService } from "./menu-import.service";

@Module({
  imports: [DatabaseModule],
  controllers: [MenuCatalogController, BranchMenuController, MenuImportController],
  providers: [MenuCatalogService, EffectiveMenuResolver, MenuImportService],
  exports: [MenuCatalogService, EffectiveMenuResolver, MenuImportService],
})
export class MenuCatalogModule {}
