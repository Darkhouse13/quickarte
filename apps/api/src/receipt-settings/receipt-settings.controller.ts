import { Body, Controller, Get, HttpCode, Inject, Param, Post, Put, Req } from "@nestjs/common";
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
  ReceiptPreviewResponseDto,
  ReceiptSettingsPutBodyDto,
  ReceiptSettingsResponseDto,
} from "./receipt-settings.dto";
import { ReceiptSettingsService } from "./receipt-settings.service";

@ApiTags("Receipt settings")
@Controller("branches/:branchId/receipt-settings")
export class ReceiptSettingsController {
  constructor(
    @Inject(ReceiptSettingsService)
    private readonly receiptSettingsService: ReceiptSettingsService,
  ) {}

  @Get()
  @RequirePermission("settings.view")
  @ApiOperation({ summary: "Get branch receipt settings" })
  @ApiParam({ name: "branchId", format: "uuid" })
  @ApiResponse({
    status: 200,
    description: "Branch receipt settings.",
    type: ReceiptSettingsResponseDto,
  })
  async getSettings(
    @Req() request: AuthenticatedRequest,
    @Param("branchId") branchId: string,
  ): Promise<ReceiptSettingsResponseDto> {
    return this.receiptSettingsService.getSettings(request.businessId!, branchId);
  }

  @Put()
  @RequirePermission("settings.update")
  @ApiOperation({ summary: "Upsert branch receipt settings" })
  @ApiParam({ name: "branchId", format: "uuid" })
  @ApiBody({ type: ReceiptSettingsPutBodyDto })
  @ApiResponse({
    status: 200,
    description: "Updated branch receipt settings.",
    type: ReceiptSettingsResponseDto,
  })
  async upsertSettings(
    @Req() request: AuthenticatedRequest,
    @Param("branchId") branchId: string,
    @Body() body: ReceiptSettingsPutBodyDto,
  ): Promise<ReceiptSettingsResponseDto> {
    return this.receiptSettingsService.upsertSettings(
      request.businessId!,
      branchId,
      body,
    );
  }

  @Post("preview")
  @HttpCode(200)
  @RequirePermission("settings.view")
  @ApiOperation({ summary: "Preview unsaved branch receipt settings" })
  @ApiParam({ name: "branchId", format: "uuid" })
  @ApiBody({ type: ReceiptSettingsPutBodyDto })
  @ApiResponse({
    status: 200,
    description: "Rendered sample receipt preview.",
    type: ReceiptPreviewResponseDto,
  })
  async preview(
    @Req() request: AuthenticatedRequest,
    @Param("branchId") branchId: string,
    @Body() body: ReceiptSettingsPutBodyDto,
  ): Promise<ReceiptPreviewResponseDto> {
    return this.receiptSettingsService.preview(
      request.businessId!,
      branchId,
      body,
    );
  }
}
