import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { PaymentMethodsController } from "./payment-methods.controller";
import { PaymentMethodsService } from "./payment-methods.service";

@Module({
  imports: [DatabaseModule],
  controllers: [PaymentMethodsController],
  providers: [PaymentMethodsService],
  exports: [PaymentMethodsService],
})
export class PaymentMethodsModule {}
