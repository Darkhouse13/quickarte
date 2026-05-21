import { Module } from "@nestjs/common";
import { ZodSampleController } from "./zod-sample.controller";

@Module({
  controllers: [ZodSampleController],
})
export class ZodSampleModule {}

