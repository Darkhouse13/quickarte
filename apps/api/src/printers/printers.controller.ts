import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Req,
} from "@nestjs/common";
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
  BranchPrintersResponseDto,
  CreatePrinterBodyDto,
  DeletePrinterResponseDto,
  PrinterResponseDto,
  ReplacePrinterAssignmentsBodyDto,
  TestPrintResponseDto,
  UpdatePrinterBodyDto,
} from "./printers.dto";
import { PrintersService } from "./printers.service";

@ApiTags("Printers")
@Controller("branches/:branchId")
export class PrintersController {
  constructor(
    @Inject(PrintersService) private readonly printersService: PrintersService,
  ) {}

  @Get("printers")
  @RequirePermission("printer.view")
  @ApiOperation({ summary: "List printers and assignments for a branch" })
  @ApiParam({ name: "branchId", format: "uuid" })
  @ApiResponse({ status: 200, type: BranchPrintersResponseDto })
  async listBranchPrinters(
    @Req() request: AuthenticatedRequest,
    @Param("branchId") branchId: string,
  ): Promise<BranchPrintersResponseDto> {
    return this.printersService.listBranchPrinters(request.businessId!, branchId);
  }

  @Post("printers")
  @RequirePermission("printer.manage")
  @ApiOperation({ summary: "Manually add a branch printer" })
  @ApiParam({ name: "branchId", format: "uuid" })
  @ApiBody({ type: CreatePrinterBodyDto })
  @ApiResponse({ status: 201, type: PrinterResponseDto })
  async createPrinter(
    @Req() request: AuthenticatedRequest,
    @Param("branchId") branchId: string,
    @Body() body: CreatePrinterBodyDto,
  ): Promise<PrinterResponseDto> {
    return this.printersService.createPrinter(request.businessId!, branchId, body);
  }

  @Patch("printers/:printerId")
  @RequirePermission("printer.manage")
  @ApiOperation({ summary: "Update branch printer metadata" })
  @ApiParam({ name: "branchId", format: "uuid" })
  @ApiParam({ name: "printerId", format: "uuid" })
  @ApiBody({ type: UpdatePrinterBodyDto })
  @ApiResponse({ status: 200, type: PrinterResponseDto })
  async updatePrinter(
    @Req() request: AuthenticatedRequest,
    @Param("branchId") branchId: string,
    @Param("printerId") printerId: string,
    @Body() body: UpdatePrinterBodyDto,
  ): Promise<PrinterResponseDto> {
    return this.printersService.updatePrinter(
      request.businessId!,
      branchId,
      printerId,
      body,
    );
  }

  @Delete("printers/:printerId")
  @RequirePermission("printer.manage")
  @ApiOperation({ summary: "Soft-delete a branch printer" })
  @ApiParam({ name: "branchId", format: "uuid" })
  @ApiParam({ name: "printerId", format: "uuid" })
  @ApiResponse({ status: 200, type: DeletePrinterResponseDto })
  async deletePrinter(
    @Req() request: AuthenticatedRequest,
    @Param("branchId") branchId: string,
    @Param("printerId") printerId: string,
  ): Promise<DeletePrinterResponseDto> {
    return this.printersService.deletePrinter(
      request.businessId!,
      branchId,
      printerId,
    );
  }

  @Post("printers/:printerId/test-print")
  @RequirePermission("printer.manage")
  @ApiOperation({ summary: "Queue a printer test job through the print pipeline" })
  @ApiParam({ name: "branchId", format: "uuid" })
  @ApiParam({ name: "printerId", format: "uuid" })
  @ApiResponse({ status: 201, type: TestPrintResponseDto })
  async enqueueTestPrint(
    @Req() request: AuthenticatedRequest,
    @Param("branchId") branchId: string,
    @Param("printerId") printerId: string,
  ): Promise<TestPrintResponseDto> {
    return this.printersService.enqueueTestPrint(
      request.businessId!,
      branchId,
      printerId,
    );
  }

  @Put("printer-assignments")
  @RequirePermission("printer.manage")
  @ApiOperation({ summary: "Replace branch printer assignments atomically" })
  @ApiParam({ name: "branchId", format: "uuid" })
  @ApiBody({ type: ReplacePrinterAssignmentsBodyDto })
  @ApiResponse({ status: 200, type: BranchPrintersResponseDto })
  async replaceAssignments(
    @Req() request: AuthenticatedRequest,
    @Param("branchId") branchId: string,
    @Body() body: ReplacePrinterAssignmentsBodyDto,
  ): Promise<BranchPrintersResponseDto> {
    return this.printersService.replaceAssignments(
      request.businessId!,
      branchId,
      body,
    );
  }
}
