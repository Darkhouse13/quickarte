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
import { MenuCatalogService } from "./menu-catalog.service";
import {
  CreateMenuCategoryDto,
  CreateMenuProductDto,
  ListMenuProductsQueryDto,
  MenuCategoriesResponseDto,
  MenuCategoryResponseDto,
  MenuDeleteResponseDto,
  MenuImagesResponseDto,
  MenuLocaleSettingsResponseDto,
  MenuProductResponseDto,
  MenuProductsResponseDto,
  MenuVariantsResponseDto,
  ReorderMenuCategoriesDto,
  ReorderMenuProductsDto,
  ReplaceMenuVariantsDto,
  ReplaceProductImagesDto,
  UpdateMenuCategoryDto,
  UpdateMenuLocaleSettingsDto,
  UpdateMenuProductDto,
} from "./menu-catalog.schemas";

@ApiTags("menu")
@Controller("menu")
@UsePipes(ZodValidationPipe)
@UseInterceptors(ZodSerializerInterceptor)
export class MenuCatalogController {
  constructor(
    @Inject(MenuCatalogService)
    private readonly menuCatalogService: MenuCatalogService,
  ) {}

  @Get("categories")
  @RequirePermission("menu.view")
  @ApiOperation({ summary: "List shared menu categories and one-level subcategories." })
  @ZodResponse({ status: 200, type: MenuCategoriesResponseDto })
  async listCategories(@Req() request: AuthenticatedRequest) {
    return {
      categories: await this.menuCatalogService.listCategories(request.businessId!),
    };
  }

  @Post("categories")
  @RequirePermission("menu.manage")
  @ApiBody({ type: CreateMenuCategoryDto })
  @ZodResponse({ status: 201, type: MenuCategoryResponseDto })
  async createCategory(
    @Req() request: AuthenticatedRequest,
    @Body() body: CreateMenuCategoryDto,
  ) {
    return this.menuCatalogService.createCategory(request.businessId!, body);
  }

  @Patch("categories/:categoryId")
  @RequirePermission("menu.manage")
  @ApiParam({ name: "categoryId" })
  @ApiBody({ type: UpdateMenuCategoryDto })
  @ZodResponse({ status: 200, type: MenuCategoryResponseDto })
  async updateCategory(
    @Req() request: AuthenticatedRequest,
    @Param("categoryId") categoryId: string,
    @Body() body: UpdateMenuCategoryDto,
  ) {
    return this.menuCatalogService.updateCategory(request.businessId!, categoryId, body);
  }

  @Delete("categories/:categoryId")
  @RequirePermission("menu.manage")
  @ApiParam({ name: "categoryId" })
  @ZodResponse({ status: 200, type: MenuDeleteResponseDto })
  async deleteCategory(
    @Req() request: AuthenticatedRequest,
    @Param("categoryId") categoryId: string,
  ) {
    await this.menuCatalogService.softDeleteCategory(request.businessId!, categoryId);
    return { deleted: true as const };
  }

  @Put("categories/reorder")
  @RequirePermission("menu.manage")
  @ApiBody({ type: ReorderMenuCategoriesDto })
  @ZodResponse({ status: 200, type: MenuCategoriesResponseDto })
  async reorderCategories(
    @Req() request: AuthenticatedRequest,
    @Body() body: ReorderMenuCategoriesDto,
  ) {
    return {
      categories: await this.menuCatalogService.reorderCategories(
        request.businessId!,
        body,
      ),
    };
  }

  @Get("products")
  @RequirePermission("menu.view")
  @ApiOperation({ summary: "List shared menu products with first-class variants." })
  @ApiQuery({ name: "categoryId", required: false, type: String })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiQuery({ name: "hidden", required: false, enum: ["true", "false"] })
  @ZodResponse({ status: 200, type: MenuProductsResponseDto })
  async listProducts(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListMenuProductsQueryDto,
  ) {
    return {
      products: await this.menuCatalogService.listProducts(request.businessId!, {
        categoryId: query.categoryId,
        search: query.search,
        includeHidden: query.hidden === "true",
      }),
    };
  }

  @Post("products")
  @RequirePermission("menu.manage")
  @ApiBody({ type: CreateMenuProductDto })
  @ZodResponse({ status: 201, type: MenuProductResponseDto })
  async createProduct(
    @Req() request: AuthenticatedRequest,
    @Body() body: CreateMenuProductDto,
  ) {
    return { product: await this.menuCatalogService.createProduct(request.businessId!, body) };
  }

  @Get("products/:productId")
  @RequirePermission("menu.view")
  @ApiParam({ name: "productId" })
  @ZodResponse({ status: 200, type: MenuProductResponseDto })
  async getProduct(
    @Req() request: AuthenticatedRequest,
    @Param("productId") productId: string,
  ) {
    return { product: await this.menuCatalogService.getProduct(request.businessId!, productId) };
  }

  @Patch("products/:productId")
  @RequirePermission("menu.manage")
  @ApiParam({ name: "productId" })
  @ApiBody({ type: UpdateMenuProductDto })
  @ZodResponse({ status: 200, type: MenuProductResponseDto })
  async updateProduct(
    @Req() request: AuthenticatedRequest,
    @Param("productId") productId: string,
    @Body() body: UpdateMenuProductDto,
  ) {
    return {
      product: await this.menuCatalogService.updateProduct(
        request.businessId!,
        productId,
        body,
      ),
    };
  }

  @Delete("products/:productId")
  @RequirePermission("menu.manage")
  @ApiParam({ name: "productId" })
  @ZodResponse({ status: 200, type: MenuDeleteResponseDto })
  async deleteProduct(
    @Req() request: AuthenticatedRequest,
    @Param("productId") productId: string,
  ) {
    await this.menuCatalogService.softDeleteProduct(request.businessId!, productId);
    return { deleted: true as const };
  }

  @Put("products/reorder")
  @RequirePermission("menu.manage")
  @ApiBody({ type: ReorderMenuProductsDto })
  @ZodResponse({ status: 200, type: MenuProductsResponseDto })
  async reorderProducts(
    @Req() request: AuthenticatedRequest,
    @Body() body: ReorderMenuProductsDto,
  ) {
    return {
      products: await this.menuCatalogService.reorderProducts(request.businessId!, body),
    };
  }

  @Put("products/:productId/variants")
  @RequirePermission("menu.manage")
  @ApiParam({ name: "productId" })
  @ApiBody({ type: ReplaceMenuVariantsDto })
  @ZodResponse({ status: 200, type: MenuVariantsResponseDto })
  async replaceVariants(
    @Req() request: AuthenticatedRequest,
    @Param("productId") productId: string,
    @Body() body: ReplaceMenuVariantsDto,
  ) {
    return {
      variants: await this.menuCatalogService.replaceVariants(
        request.businessId!,
        productId,
        body,
      ),
    };
  }

  @Put("products/:productId/images")
  @RequirePermission("menu.manage")
  @ApiParam({ name: "productId" })
  @ApiBody({ type: ReplaceProductImagesDto })
  @ZodResponse({ status: 200, type: MenuImagesResponseDto })
  async replaceImages(
    @Req() request: AuthenticatedRequest,
    @Param("productId") productId: string,
    @Body() body: ReplaceProductImagesDto,
  ) {
    return {
      images: await this.menuCatalogService.replaceImages(
        request.businessId!,
        productId,
        body,
      ),
    };
  }

  @Get("locale-settings")
  @RequirePermission("menu.view")
  @ZodResponse({ status: 200, type: MenuLocaleSettingsResponseDto })
  getLocaleSettings(@Req() request: AuthenticatedRequest) {
    return this.menuCatalogService.getLocaleSettings(request.businessId!);
  }

  @Put("locale-settings")
  @RequirePermission("menu.manage")
  @ApiBody({ type: UpdateMenuLocaleSettingsDto })
  @ZodResponse({ status: 200, type: MenuLocaleSettingsResponseDto })
  updateLocaleSettings(
    @Req() request: AuthenticatedRequest,
    @Body() body: UpdateMenuLocaleSettingsDto,
  ) {
    return this.menuCatalogService.updateLocaleSettings(request.businessId!, body);
  }
}
