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
  UseInterceptors,
  UsePipes,
} from "@nestjs/common";
import { ApiBody, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import {
  ZodResponse,
  ZodSerializerInterceptor,
  ZodValidationPipe,
} from "nestjs-zod";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import type { AuthenticatedRequest } from "../common/middleware/tenant-context.middleware";
import { IngredientsService } from "./ingredients.service";
import {
  CreateIngredientDto,
  IngredientConversionsResponseDto,
  IngredientDeleteResponseDto,
  IngredientResponseDto,
  IngredientTagsResponseDto,
  IngredientsResponseDto,
  ReplaceIngredientConversionsDto,
  ReplaceIngredientTagsDto,
  UnitsResponseDto,
  UpdateIngredientDto,
} from "./ingredients.schemas";

@ApiTags("ingredients")
@Controller()
@UsePipes(ZodValidationPipe)
@UseInterceptors(ZodSerializerInterceptor)
export class IngredientsController {
  constructor(
    @Inject(IngredientsService)
    private readonly ingredientsService: IngredientsService,
  ) {}

  @Get("units")
  @RequirePermission("ingredient.view")
  @ApiOperation({ summary: "List global units of measure." })
  @ZodResponse({ status: 200, type: UnitsResponseDto })
  async listUnits(@Req() request: AuthenticatedRequest) {
    return { units: await this.ingredientsService.listUnits(request.businessId!) };
  }

  @Get("ingredients")
  @RequirePermission("ingredient.view")
  @ApiOperation({ summary: "List ingredients for the current tenant." })
  @ZodResponse({ status: 200, type: IngredientsResponseDto })
  async listIngredients(@Req() request: AuthenticatedRequest) {
    return {
      ingredients: await this.ingredientsService.listIngredients(request.businessId!),
    };
  }

  @Post("ingredients")
  @RequirePermission("ingredient.manage")
  @ApiBody({ type: CreateIngredientDto })
  @ZodResponse({ status: 201, type: IngredientResponseDto })
  async createIngredient(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(CreateIngredientDto)) body: CreateIngredientDto,
  ) {
    return this.ingredientsService.createIngredient(request.businessId!, body);
  }

  @Get("ingredients/:ingredientId")
  @RequirePermission("ingredient.view")
  @ApiParam({ name: "ingredientId", type: String, format: "uuid" })
  @ZodResponse({ status: 200, type: IngredientResponseDto })
  async getIngredient(
    @Req() request: AuthenticatedRequest,
    @Param("ingredientId") ingredientId: string,
  ) {
    return this.ingredientsService.getIngredient(request.businessId!, ingredientId);
  }

  @Patch("ingredients/:ingredientId")
  @RequirePermission("ingredient.manage")
  @ApiParam({ name: "ingredientId", type: String, format: "uuid" })
  @ApiBody({ type: UpdateIngredientDto })
  @ZodResponse({ status: 200, type: IngredientResponseDto })
  async updateIngredient(
    @Req() request: AuthenticatedRequest,
    @Param("ingredientId") ingredientId: string,
    @Body(new ZodValidationPipe(UpdateIngredientDto)) body: UpdateIngredientDto,
  ) {
    return this.ingredientsService.updateIngredient(
      request.businessId!,
      ingredientId,
      body,
    );
  }

  @Delete("ingredients/:ingredientId")
  @RequirePermission("ingredient.manage")
  @ApiParam({ name: "ingredientId", type: String, format: "uuid" })
  @ZodResponse({ status: 200, type: IngredientDeleteResponseDto })
  async deleteIngredient(
    @Req() request: AuthenticatedRequest,
    @Param("ingredientId") ingredientId: string,
  ) {
    await this.ingredientsService.softDeleteIngredient(
      request.businessId!,
      ingredientId,
    );
    return { deleted: true as const };
  }

  @Put("ingredients/:ingredientId/conversions")
  @RequirePermission("ingredient.manage")
  @ApiParam({ name: "ingredientId", type: String, format: "uuid" })
  @ApiBody({ type: ReplaceIngredientConversionsDto })
  @ZodResponse({ status: 200, type: IngredientConversionsResponseDto })
  async replaceConversions(
    @Req() request: AuthenticatedRequest,
    @Param("ingredientId") ingredientId: string,
    @Body(new ZodValidationPipe(ReplaceIngredientConversionsDto))
    body: ReplaceIngredientConversionsDto,
  ) {
    return this.ingredientsService.replaceConversions(
      request.businessId!,
      ingredientId,
      body,
    );
  }

  @Put("ingredients/:ingredientId/tags")
  @RequirePermission("ingredient.manage")
  @ApiParam({ name: "ingredientId", type: String, format: "uuid" })
  @ApiBody({ type: ReplaceIngredientTagsDto })
  @ZodResponse({ status: 200, type: IngredientTagsResponseDto })
  async replaceTags(
    @Req() request: AuthenticatedRequest,
    @Param("ingredientId") ingredientId: string,
    @Body(new ZodValidationPipe(ReplaceIngredientTagsDto))
    body: ReplaceIngredientTagsDto,
  ) {
    return this.ingredientsService.replaceTags(
      request.businessId!,
      ingredientId,
      body,
    );
  }
}
