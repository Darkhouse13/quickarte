import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { StockController } from "./stock.controller";
import { StockService } from "./stock.service";

@Module({
  imports: [DatabaseModule],
  controllers: [StockController],
  providers: [StockService],
  exports: [StockService],
})
export class StockModule {}
