import { Body, Controller, Post, UseInterceptors, UsePipes } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  ZodResponse,
  ZodSerializerInterceptor,
  ZodValidationPipe,
} from "nestjs-zod";
import {
  SampleEffectiveMenuRequestDto,
  SampleEffectiveMenuResponseDto,
  type SampleEffectiveMenuResponse,
} from "./sample-menu.schema";

@ApiTags("zod-sample")
@Controller("_samples")
@UsePipes(ZodValidationPipe)
@UseInterceptors(ZodSerializerInterceptor)
export class ZodSampleController {
  @Post("effective-menu")
  @ApiOperation({
    summary:
      "Test-only sample proving Zod DTOs generate precise nested menu SDK types.",
  })
  @ApiBody({ type: SampleEffectiveMenuRequestDto })
  @ZodResponse({
    status: 200,
    type: SampleEffectiveMenuResponseDto,
    description: "Nested effective-menu sample with decimal-string money fields.",
  })
  getEffectiveMenuSample(
    @Body() _body: SampleEffectiveMenuRequestDto,
  ): SampleEffectiveMenuResponse {
    return {
      branchId: "11111111-1111-4111-8111-111111111111",
      generatedAt: "2026-05-21T00:00:00.000Z",
      categories: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          name: { fr: "Grillades", ar: "مشويات" },
          products: [
            {
              id: "33333333-3333-4333-8333-333333333333",
              name: { fr: "Poulet rôti" },
              effectivePrice: "42.50",
              variants: [
                {
                  id: "44444444-4444-4444-8444-444444444444",
                  name: "1/2 poulet",
                  effectivePrice: "42.50",
                  pricingMode: "fixed",
                },
              ],
            },
          ],
        },
      ],
    };
  }
}
