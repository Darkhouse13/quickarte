import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseInterceptors,
  UsePipes,
} from "@nestjs/common";
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import {
  ZodResponse,
  ZodSerializerInterceptor,
  ZodValidationPipe,
} from "nestjs-zod";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import type { AuthenticatedRequest } from "../common/middleware/tenant-context.middleware";
import {
  CreateStockAdjustmentDto,
  StockAdjustmentResponseDto,
  StockLevelsResponseDto,
  StockMovementsResponseDto,
} from "./stock.schemas";
import { StockService } from "./stock.service";

@ApiTags("stock")
@Controller()
@UsePipes(ZodValidationPipe)
@UseInterceptors(ZodSerializerInterceptor)
export class StockController {
  constructor(
    @Inject(StockService)
    private readonly stockService: StockService,
  ) {}

  @Get("branches/:branchId/stock")
  @RequirePermission("stock.view")
  @ApiParam({ name: "branchId", type: String, format: "uuid" })
  @ApiOperation({ summary: "List current stock levels for a branch." })
  @ZodResponse({ status: 200, type: StockLevelsResponseDto })
  async listLevels(
    @Req() request: AuthenticatedRequest,
    @Param("branchId") branchId: string,
  ) {
    return this.stockService.listLevels(request.businessId!, branchId);
  }

  @Get("branches/:branchId/stock/movements")
  @RequirePermission("stock.view")
  @ApiParam({ name: "branchId", type: String, format: "uuid" })
  @ApiQuery({ name: "ingredientId", required: false, type: String, format: "uuid" })
  @ApiOperation({ summary: "List stock ledger movements for a branch." })
  @ZodResponse({ status: 200, type: StockMovementsResponseDto })
  async listMovements(
    @Req() request: AuthenticatedRequest,
    @Param("branchId") branchId: string,
    @Query("ingredientId") ingredientId?: string,
  ) {
    return this.stockService.listMovements(request.businessId!, branchId, {
      ingredientId,
    });
  }

  @Post("branches/:branchId/stock/adjustments")
  @RequirePermission("stock.adjust")
  @ApiParam({ name: "branchId", type: String, format: "uuid" })
  @ApiBody({ type: CreateStockAdjustmentDto })
  @ApiOperation({ summary: "Append a manual stock adjustment movement." })
  @ZodResponse({ status: 201, type: StockAdjustmentResponseDto })
  async createAdjustment(
    @Req() request: AuthenticatedRequest,
    @Param("branchId") branchId: string,
    @Body(new ZodValidationPipe(CreateStockAdjustmentDto)) body: CreateStockAdjustmentDto,
  ) {
    return this.stockService.adjustStockFromDto(
      request.businessId!,
      branchId,
      request.userId ?? null,
      body,
    );
  }
}
