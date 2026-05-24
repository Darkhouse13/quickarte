import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { IngredientsController } from "./ingredients.controller";
import { IngredientsService } from "./ingredients.service";

@Module({
  imports: [DatabaseModule],
  controllers: [IngredientsController],
  providers: [IngredientsService],
  exports: [IngredientsService],
})
export class IngredientsModule {}
