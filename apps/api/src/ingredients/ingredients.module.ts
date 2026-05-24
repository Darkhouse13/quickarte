import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { RecipesModule } from "../recipes/recipes.module";
import { IngredientImportController } from "./ingredient-import.controller";
import { IngredientImportService } from "./ingredient-import.service";
import { IngredientsController } from "./ingredients.controller";
import { IngredientsService } from "./ingredients.service";

@Module({
  imports: [DatabaseModule, RecipesModule],
  controllers: [IngredientsController, IngredientImportController],
  providers: [IngredientsService, IngredientImportService],
  exports: [IngredientsService, IngredientImportService],
})
export class IngredientsModule {}
