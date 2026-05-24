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
import { RecipesService } from "./recipes.service";
import {
  CreateRecipeDto,
  RecipeDeleteResponseDto,
  RecipeResponseDto,
  RecipesResponseDto,
  ReplaceRecipeLinesDto,
  UpdateRecipeDto,
} from "./recipes.schemas";

@ApiTags("recipes")
@Controller()
@UsePipes(ZodValidationPipe)
@UseInterceptors(ZodSerializerInterceptor)
export class RecipesController {
  constructor(
    @Inject(RecipesService)
    private readonly recipesService: RecipesService,
  ) {}

  @Get("recipes")
  @RequirePermission("recipe.view")
  @ApiOperation({ summary: "List recipes for the current tenant." })
  @ZodResponse({ status: 200, type: RecipesResponseDto })
  async listRecipes(@Req() request: AuthenticatedRequest) {
    return this.recipesService.listRecipes(request.businessId!);
  }

  @Post("recipes")
  @RequirePermission("recipe.manage")
  @ApiOperation({ summary: "Create a variant recipe or sub-recipe." })
  @ApiBody({ type: CreateRecipeDto })
  @ZodResponse({ status: 201, type: RecipeResponseDto })
  async createRecipe(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(CreateRecipeDto)) body: CreateRecipeDto,
  ) {
    return this.recipesService.createRecipe(request.businessId!, body);
  }

  @Get("recipes/by-variant/:variantId")
  @RequirePermission("recipe.view")
  @ApiParam({ name: "variantId", type: String, format: "uuid" })
  @ZodResponse({ status: 200, type: RecipeResponseDto })
  async getRecipeByVariant(
    @Req() request: AuthenticatedRequest,
    @Param("variantId") variantId: string,
  ) {
    return this.recipesService.getRecipeByVariant(request.businessId!, variantId);
  }

  @Get("recipes/:recipeId")
  @RequirePermission("recipe.view")
  @ApiParam({ name: "recipeId", type: String, format: "uuid" })
  @ZodResponse({ status: 200, type: RecipeResponseDto })
  async getRecipe(
    @Req() request: AuthenticatedRequest,
    @Param("recipeId") recipeId: string,
  ) {
    return this.recipesService.getRecipe(request.businessId!, recipeId);
  }

  @Patch("recipes/:recipeId")
  @RequirePermission("recipe.manage")
  @ApiParam({ name: "recipeId", type: String, format: "uuid" })
  @ApiBody({ type: UpdateRecipeDto })
  @ZodResponse({ status: 200, type: RecipeResponseDto })
  async updateRecipe(
    @Req() request: AuthenticatedRequest,
    @Param("recipeId") recipeId: string,
    @Body(new ZodValidationPipe(UpdateRecipeDto)) body: UpdateRecipeDto,
  ) {
    return this.recipesService.updateRecipe(request.businessId!, recipeId, body);
  }

  @Delete("recipes/:recipeId")
  @RequirePermission("recipe.manage")
  @ApiParam({ name: "recipeId", type: String, format: "uuid" })
  @ZodResponse({ status: 200, type: RecipeDeleteResponseDto })
  async deleteRecipe(
    @Req() request: AuthenticatedRequest,
    @Param("recipeId") recipeId: string,
  ) {
    await this.recipesService.deleteRecipe(request.businessId!, recipeId);
    return { deleted: true as const };
  }

  @Put("recipes/:recipeId/lines")
  @RequirePermission("recipe.manage")
  @ApiParam({ name: "recipeId", type: String, format: "uuid" })
  @ApiBody({ type: ReplaceRecipeLinesDto })
  @ZodResponse({ status: 200, type: RecipeResponseDto })
  async replaceLines(
    @Req() request: AuthenticatedRequest,
    @Param("recipeId") recipeId: string,
    @Body(new ZodValidationPipe(ReplaceRecipeLinesDto)) body: ReplaceRecipeLinesDto,
  ) {
    return this.recipesService.replaceLines(request.businessId!, recipeId, body);
  }
}
