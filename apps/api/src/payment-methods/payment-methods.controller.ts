import { Body, Controller, Get, Inject, Param, Put, Req } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import type { AuthenticatedRequest } from "../common/middleware/tenant-context.middleware";
import {
  BranchPaymentMethodsResponseDto,
  PaymentMethodDefinitionsResponseDto,
  PaymentMethodsPutBodyDto,
} from "./payment-methods.dto";
import { PaymentMethodsService } from "./payment-methods.service";

@ApiTags("Payment methods")
@Controller()
export class PaymentMethodsController {
  constructor(
    @Inject(PaymentMethodsService)
    private readonly paymentMethodsService: PaymentMethodsService,
  ) {}

  @Get("payment-method-definitions")
  @RequirePermission("payment_methods.view")
  @ApiOperation({ summary: "List global payment method definitions" })
  @ApiResponse({
    status: 200,
    description: "Built-in payment method definitions.",
    type: PaymentMethodDefinitionsResponseDto,
  })
  async definitions(
    @Req() request: AuthenticatedRequest,
  ): Promise<PaymentMethodDefinitionsResponseDto> {
    return {
      definitions: await this.paymentMethodsService.listDefinitions(request.businessId!),
    };
  }

  @Get("branches/:branchId/payment-methods")
  @RequirePermission("payment_methods.view")
  @ApiOperation({ summary: "Get branch payment methods" })
  @ApiParam({ name: "branchId", format: "uuid" })
  @ApiResponse({
    status: 200,
    description: "Branch payment method configuration.",
    type: BranchPaymentMethodsResponseDto,
  })
  async getBranchMethods(
    @Req() request: AuthenticatedRequest,
    @Param("branchId") branchId: string,
  ): Promise<BranchPaymentMethodsResponseDto> {
    return this.paymentMethodsService.getBranchMethods(request.businessId!, branchId);
  }

  @Put("branches/:branchId/payment-methods")
  @RequirePermission("payment_methods.update")
  @ApiOperation({ summary: "Replace branch payment methods" })
  @ApiParam({ name: "branchId", format: "uuid" })
  @ApiBody({ type: PaymentMethodsPutBodyDto })
  @ApiResponse({
    status: 200,
    description: "Updated branch payment methods.",
    type: BranchPaymentMethodsResponseDto,
  })
  async replaceBranchMethods(
    @Req() request: AuthenticatedRequest,
    @Param("branchId") branchId: string,
    @Body() body: PaymentMethodsPutBodyDto,
  ): Promise<BranchPaymentMethodsResponseDto> {
    return this.paymentMethodsService.replaceBranchMethods(
      request.businessId!,
      branchId,
      body,
    );
  }
}
