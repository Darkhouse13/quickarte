import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { RecipesModule } from "../recipes/recipes.module";
import { IngredientsController } from "./ingredients.controller";
import { IngredientsService } from "./ingredients.service";

@Module({
  imports: [DatabaseModule, RecipesModule],
  controllers: [IngredientsController],
  providers: [IngredientsService],
  exports: [IngredientsService],
})
export class IngredientsModule {}
