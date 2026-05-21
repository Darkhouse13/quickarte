import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { BranchMenuController } from "./branch-menu.controller";
import { EffectiveMenuResolver } from "./effective-menu.resolver";
import { MenuCatalogController } from "./menu-catalog.controller";
import { MenuCatalogService } from "./menu-catalog.service";

@Module({
  imports: [DatabaseModule],
  controllers: [MenuCatalogController, BranchMenuController],
  providers: [MenuCatalogService, EffectiveMenuResolver],
  exports: [MenuCatalogService, EffectiveMenuResolver],
})
export class MenuCatalogModule {}
