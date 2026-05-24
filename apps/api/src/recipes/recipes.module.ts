import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { RecipesController } from "./recipes.controller";
import { RecipesService } from "./recipes.service";

@Module({
  imports: [DatabaseModule],
  controllers: [RecipesController],
  providers: [RecipesService],
  exports: [RecipesService],
})
export class RecipesModule {}
