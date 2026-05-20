import { Body, Controller, Get, Inject, Param, Put, Req } from "@nestjs/common";
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import type { AuthenticatedRequest } from "../common/middleware/tenant-context.middleware";
import {
  BranchTaxConfigPutBodyDto,
  BranchTaxConfigResponseDto,
  TaxRatesResponseDto,
} from "./tax-config.dto";
import { TaxConfigService } from "./tax-config.service";

@ApiTags("Tax configuration")
@Controller()
export class TaxConfigController {
  constructor(
    @Inject(TaxConfigService)
    private readonly taxConfigService: TaxConfigService,
  ) {}

  @Get("tax-rates")
  @RequirePermission("tax.view")
  @ApiOperation({ summary: "List active Moroccan TVA rates" })
  @ApiResponse({
    status: 200,
    description: "Active tax rates.",
    type: TaxRatesResponseDto,
  })
  async listRates(
    @Req() request: AuthenticatedRequest,
  ): Promise<TaxRatesResponseDto> {
    return {
      rates: await this.taxConfigService.listRates(request.businessId!),
    };
  }

  @Get("branches/:branchId/tax-config")
  @RequirePermission("tax.view")
  @ApiOperation({ summary: "Get branch tax configuration" })
  @ApiParam({ name: "branchId", format: "uuid" })
  @ApiResponse({
    status: 200,
    description: "Branch tax configuration.",
    type: BranchTaxConfigResponseDto,
  })
  async getBranchConfig(
    @Req() request: AuthenticatedRequest,
    @Param("branchId") branchId: string,
  ): Promise<BranchTaxConfigResponseDto> {
    return this.taxConfigService.getBranchConfig(request.businessId!, branchId);
  }

  @Put("branches/:branchId/tax-config")
  @RequirePermission("tax.update")
  @ApiOperation({ summary: "Upsert branch tax configuration" })
  @ApiParam({ name: "branchId", format: "uuid" })
  @ApiBody({ type: BranchTaxConfigPutBodyDto })
  @ApiResponse({
    status: 200,
    description: "Updated branch tax configuration.",
    type: BranchTaxConfigResponseDto,
  })
  async upsertBranchConfig(
    @Req() request: AuthenticatedRequest,
    @Param("branchId") branchId: string,
    @Body() body: BranchTaxConfigPutBodyDto,
  ): Promise<BranchTaxConfigResponseDto> {
    return this.taxConfigService.upsertBranchConfig(
      request.businessId!,
      branchId,
      body,
    );
  }
}
