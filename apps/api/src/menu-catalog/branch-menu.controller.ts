import { Body, Controller, Get, Inject, Param, Patch, Put, Query, Req, UseInterceptors, UsePipes } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { ZodResponse, ZodSerializerInterceptor, ZodValidationPipe } from "nestjs-zod";
import { RequireAnyPermission, RequirePermission } from "../common/decorators/require-permission.decorator";
import type { AuthenticatedRequest } from "../common/middleware/tenant-context.middleware";
import {
  BranchMenuOverridesResponseDto,
  EffectiveMenuResponseDto,
  ReplaceBranchMenuOverridesDto,
  ReplaceBranchProductPricesDto,
  ReplaceMenuPrintRoutesDto,
  ReplaceMenuTaxOverridesDto,
  UpdateProductAvailabilityDto,
  menuChannelSchema,
  type MenuChannel,
} from "./branch-menu.schemas";
import { EffectiveMenuResolver } from "./effective-menu.resolver";

@ApiTags("menu")
@Controller("branches/:branchId")
@UsePipes(ZodValidationPipe)
@UseInterceptors(ZodSerializerInterceptor)
export class BranchMenuController {
  constructor(
    @Inject(EffectiveMenuResolver)
    private readonly effectiveMenuResolver: EffectiveMenuResolver,
  ) {}

  @Get("menu/effective")
  @RequirePermission("menu.view")
  @ApiOperation({ summary: "Resolve the effective menu for one branch and channel." })
  @ApiParam({ name: "branchId" })
  @ApiQuery({ name: "channel", required: false, enum: menuChannelSchema.options })
  @ZodResponse({ status: 200, type: EffectiveMenuResponseDto })
  getEffectiveMenu(
    @Req() request: AuthenticatedRequest,
    @Param("branchId") branchId: string,
    @Query("channel") channel?: string,
  ) {
    const parsedChannel = menuChannelSchema.catch("pos").parse(channel);
    return this.effectiveMenuResolver.getEffectiveMenu(
      request.businessId!,
      branchId,
      parsedChannel as MenuChannel,
    );
  }

  @Get("menu-overrides")
  @RequirePermission("menu.view")
  @ApiParam({ name: "branchId" })
  @ZodResponse({ status: 200, type: BranchMenuOverridesResponseDto })
  getOverrides(
    @Req() request: AuthenticatedRequest,
    @Param("branchId") branchId: string,
  ) {
    return this.effectiveMenuResolver.getOverrides(request.businessId!, branchId);
  }

  @Put("menu-overrides")
  @RequirePermission("menu.manage")
  @ApiParam({ name: "branchId" })
  @ApiBody({ type: ReplaceBranchMenuOverridesDto })
  @ZodResponse({ status: 200, type: BranchMenuOverridesResponseDto })
  replaceOverrides(
    @Req() request: AuthenticatedRequest,
    @Param("branchId") branchId: string,
    @Body() body: ReplaceBranchMenuOverridesDto,
  ) {
    return this.effectiveMenuResolver.replaceOverrides(request.businessId!, branchId, body);
  }

  @Put("menu-tax-overrides")
  @RequireAnyPermission("menu.manage", "tax.update")
  @ApiParam({ name: "branchId" })
  @ApiBody({ type: ReplaceMenuTaxOverridesDto })
  @ZodResponse({ status: 200, type: BranchMenuOverridesResponseDto })
  replaceTaxOverrides(
    @Req() request: AuthenticatedRequest,
    @Param("branchId") branchId: string,
    @Body() body: ReplaceMenuTaxOverridesDto,
  ) {
    return this.effectiveMenuResolver.replaceTaxOverrides(request.businessId!, branchId, body);
  }

  @Put("menu-print-routes")
  @RequirePermission("printer.manage")
  @ApiParam({ name: "branchId" })
  @ApiBody({ type: ReplaceMenuPrintRoutesDto })
  @ZodResponse({ status: 200, type: BranchMenuOverridesResponseDto })
  replacePrintRoutes(
    @Req() request: AuthenticatedRequest,
    @Param("branchId") branchId: string,
    @Body() body: ReplaceMenuPrintRoutesDto,
  ) {
    return this.effectiveMenuResolver.replacePrintRoutes(request.businessId!, branchId, body);
  }

  @Patch("products/:productId/availability")
  @RequireAnyPermission("menu.manage", "order.update")
  @ApiParam({ name: "branchId" })
  @ApiParam({ name: "productId" })
  @ApiBody({ type: UpdateProductAvailabilityDto })
  @ZodResponse({ status: 200, type: BranchMenuOverridesResponseDto })
  updateProductAvailability(
    @Req() request: AuthenticatedRequest,
    @Param("branchId") branchId: string,
    @Param("productId") productId: string,
    @Body() body: UpdateProductAvailabilityDto,
  ) {
    return this.effectiveMenuResolver.updateProductAvailability(
      request.businessId!,
      branchId,
      productId,
      request.userId!,
      body,
    );
  }

  @Put("products/:productId/prices")
  @RequirePermission("menu.manage")
  @ApiParam({ name: "branchId" })
  @ApiParam({ name: "productId" })
  @ApiBody({ type: ReplaceBranchProductPricesDto })
  @ZodResponse({ status: 200, type: BranchMenuOverridesResponseDto })
  replaceProductPrices(
    @Req() request: AuthenticatedRequest,
    @Param("branchId") branchId: string,
    @Param("productId") productId: string,
    @Body() body: ReplaceBranchProductPricesDto,
  ) {
    return this.effectiveMenuResolver.replaceProductPrices(
      request.businessId!,
      branchId,
      productId,
      body,
    );
  }
}
