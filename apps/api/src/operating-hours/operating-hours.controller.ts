import { Body, Controller, Get, Inject, Param, Put, Req } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import type { AuthenticatedRequest } from "../common/middleware/tenant-context.middleware";
import {
  OperatingHoursPutBodyDto,
  OperatingHoursResponseDto,
} from "./operating-hours.dto";
import { OperatingHoursService } from "./operating-hours.service";

@ApiTags("Operating hours")
@Controller("branches/:branchId/operating-hours")
export class OperatingHoursController {
  constructor(
    @Inject(OperatingHoursService)
    private readonly operatingHoursService: OperatingHoursService,
  ) {}

  @Get()
  @RequirePermission("settings.view")
  @ApiOperation({ summary: "Get branch operating hours" })
  @ApiParam({ name: "branchId", format: "uuid" })
  @ApiResponse({
    status: 200,
    description: "Branch normal and Ramadan schedules plus closed days.",
    type: OperatingHoursResponseDto,
  })
  async get(
    @Req() request: AuthenticatedRequest,
    @Param("branchId") branchId: string,
  ): Promise<OperatingHoursResponseDto> {
    return this.operatingHoursService.get(request.businessId!, branchId);
  }

  @Put()
  @RequirePermission("settings.update")
  @ApiOperation({ summary: "Replace branch operating hours" })
  @ApiParam({ name: "branchId", format: "uuid" })
  @ApiBody({ type: OperatingHoursPutBodyDto })
  @ApiResponse({
    status: 200,
    description: "Updated branch schedules.",
    type: OperatingHoursResponseDto,
  })
  async replace(
    @Req() request: AuthenticatedRequest,
    @Param("branchId") branchId: string,
    @Body() body: OperatingHoursPutBodyDto,
  ): Promise<OperatingHoursResponseDto> {
    return this.operatingHoursService.replace(request.businessId!, branchId, body);
  }
}
