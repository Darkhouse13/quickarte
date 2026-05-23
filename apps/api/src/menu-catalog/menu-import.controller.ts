import {
  Controller,
  Get,
  Header,
  Inject,
  Param,
  Post,
  Req,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
  UsePipes,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
} from "@nestjs/swagger";
import {
  ZodResponse,
  ZodSerializerInterceptor,
  ZodValidationPipe,
} from "nestjs-zod";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import type { AuthenticatedRequest } from "../common/middleware/tenant-context.middleware";
import {
  MENU_IMPORT_MAX_FILE_BYTES,
  type UploadedImportFile,
} from "./menu-import.parser";
import { MenuImportService } from "./menu-import.service";
import {
  MenuImportCommitResponseDto,
  MenuImportJobResponseDto,
  MenuImportUploadResponseDto,
} from "./menu-import.schemas";

@ApiTags("menu-import")
@Controller("menu/import")
@UsePipes(ZodValidationPipe)
@UseInterceptors(ZodSerializerInterceptor)
export class MenuImportController {
  constructor(
    @Inject(MenuImportService)
    private readonly menuImportService: MenuImportService,
  ) {}

  @Post()
  @RequirePermission("menu.manage")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: MENU_IMPORT_MAX_FILE_BYTES },
    }),
  )
  @ApiOperation({ summary: "Upload an Excel or CSV menu import file and preview all rows." })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: {
        file: {
          type: "string",
          format: "binary",
        },
      },
    },
  })
  @ZodResponse({ status: 201, type: MenuImportUploadResponseDto })
  uploadImport(
    @Req() request: AuthenticatedRequest,
    @UploadedFile() file: UploadedImportFile,
  ) {
    return this.menuImportService.uploadAndPreview(
      request.businessId!,
      request.userId!,
      file,
    );
  }

  @Get("template")
  @RequirePermission("menu.view")
  @ApiOperation({ summary: "Download the menu import workbook template." })
  @ApiProduces("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
  @Header(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  )
  @Header("Content-Disposition", 'attachment; filename="mizan-menu-import-template.xlsx"')
  async downloadTemplate(@Req() request: AuthenticatedRequest) {
    const buffer = await this.menuImportService.buildTemplateWorkbook(request.businessId!);
    return new StreamableFile(buffer);
  }

  @Post(":jobId/commit")
  @RequirePermission("menu.manage")
  @ApiOperation({ summary: "Commit a reviewed menu import job atomically." })
  @ApiParam({ name: "jobId", schema: { type: "string", format: "uuid" } })
  @ZodResponse({ status: 201, type: MenuImportCommitResponseDto })
  commitImportJob(
    @Req() request: AuthenticatedRequest,
    @Param("jobId") jobId: string,
  ) {
    return this.menuImportService.commitJob(
      request.businessId!,
      request.userId!,
      jobId,
    );
  }

  @Get(":jobId")
  @RequirePermission("menu.manage")
  @ApiOperation({ summary: "Fetch a stored menu import preview job." })
  @ApiParam({ name: "jobId", schema: { type: "string", format: "uuid" } })
  @ZodResponse({ status: 200, type: MenuImportJobResponseDto })
  getImportJob(
    @Req() request: AuthenticatedRequest,
    @Param("jobId") jobId: string,
  ) {
    return this.menuImportService.getJob(request.businessId!, jobId);
  }
}
