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
  INGREDIENT_IMPORT_MAX_FILE_BYTES,
  type UploadedIngredientImportFile,
} from "./ingredient-import.parser";
import { IngredientImportService } from "./ingredient-import.service";
import {
  IngredientImportCommitResponseDto,
  IngredientImportJobResponseDto,
  IngredientImportUploadResponseDto,
} from "./ingredient-import.schemas";

@ApiTags("ingredient-import")
@Controller("ingredients/import")
@UsePipes(ZodValidationPipe)
@UseInterceptors(ZodSerializerInterceptor)
export class IngredientImportController {
  constructor(
    @Inject(IngredientImportService)
    private readonly ingredientImportService: IngredientImportService,
  ) {}

  @Post()
  @RequirePermission("ingredient.manage")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: INGREDIENT_IMPORT_MAX_FILE_BYTES },
    }),
  )
  @ApiOperation({ summary: "Upload an Excel or CSV ingredient import file and preview all rows." })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: {
        file: { type: "string", format: "binary" },
      },
    },
  })
  @ZodResponse({ status: 201, type: IngredientImportUploadResponseDto })
  uploadImport(
    @Req() request: AuthenticatedRequest,
    @UploadedFile() file: UploadedIngredientImportFile,
  ) {
    return this.ingredientImportService.uploadAndPreview(
      request.businessId!,
      request.userId!,
      file,
    );
  }

  @Get("template")
  @RequirePermission("ingredient.view")
  @ApiOperation({ summary: "Download the ingredient import workbook template." })
  @ApiProduces("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
  @Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
  @Header("Content-Disposition", 'attachment; filename="mizan-ingredient-import-template.xlsx"')
  async downloadTemplate(@Req() request: AuthenticatedRequest) {
    const buffer = await this.ingredientImportService.buildTemplateWorkbook(request.businessId!);
    return new StreamableFile(buffer);
  }

  @Post(":jobId/commit")
  @RequirePermission("ingredient.manage")
  @ApiOperation({ summary: "Commit a reviewed ingredient import job atomically." })
  @ApiParam({ name: "jobId", schema: { type: "string", format: "uuid" } })
  @ZodResponse({ status: 201, type: IngredientImportCommitResponseDto })
  commitImportJob(
    @Req() request: AuthenticatedRequest,
    @Param("jobId") jobId: string,
  ) {
    return this.ingredientImportService.commitJob(
      request.businessId!,
      request.userId!,
      jobId,
    );
  }

  @Get(":jobId")
  @RequirePermission("ingredient.manage")
  @ApiOperation({ summary: "Fetch a stored ingredient import preview job." })
  @ApiParam({ name: "jobId", schema: { type: "string", format: "uuid" } })
  @ZodResponse({ status: 200, type: IngredientImportJobResponseDto })
  getImportJob(
    @Req() request: AuthenticatedRequest,
    @Param("jobId") jobId: string,
  ) {
    return this.ingredientImportService.getJob(request.businessId!, jobId);
  }
}
