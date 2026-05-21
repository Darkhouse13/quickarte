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
  AttachModifierGroupsDto,
  CreateDietaryTagDto,
  CreateModifierGroupDto,
  CreateMenuCategoryDto,
  CreateMenuProductDto,
  ListMenuProductsQueryDto,
  MenuCategoriesResponseDto,
  MenuCategoryResponseDto,
  MenuDeleteResponseDto,
  MenuAvailabilityWindowsResponseDto,
  MenuEffectiveModifierGroupsResponseDto,
  MenuImagesResponseDto,
  MenuLocaleSettingsResponseDto,
  MenuModifierGroupResponseDto,
  MenuModifierGroupsResponseDto,
  MenuProductResponseDto,
  MenuProductsResponseDto,
  MenuTagResponseDto,
  MenuTagsResponseDto,
  MenuVariantsResponseDto,
  ReorderMenuCategoriesDto,
  ReorderMenuProductsDto,
  ReplaceMenuVariantsDto,
  ReplaceProductImagesDto,
  ReplaceProductAvailabilityWindowsDto,
  ReplaceProductTagsDto,
  UpdateMenuCategoryDto,
  UpdateMenuLocaleSettingsDto,
  UpdateModifierGroupDto,
  UpdateMenuProductDto,
  UpdateDietaryTagDto,
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

  @Put("categories/:categoryId/modifier-groups")
  @RequirePermission("menu.manage")
  @ApiParam({ name: "categoryId" })
  @ApiBody({ type: AttachModifierGroupsDto })
  @ZodResponse({ status: 200, type: MenuEffectiveModifierGroupsResponseDto })
  async attachModifierGroupsToCategory(
    @Req() request: AuthenticatedRequest,
    @Param("categoryId") categoryId: string,
    @Body() body: AttachModifierGroupsDto,
  ) {
    return {
      groups: await this.menuCatalogService.attachModifierGroupsToCategory(
        request.businessId!,
        categoryId,
        body,
      ),
    };
  }

  @Get("modifier-groups")
  @RequirePermission("menu.view")
  @ApiOperation({ summary: "List reusable modifier group templates." })
  @ZodResponse({ status: 200, type: MenuModifierGroupsResponseDto })
  async listModifierGroups(@Req() request: AuthenticatedRequest) {
    return {
      groups: await this.menuCatalogService.listModifierGroups(request.businessId!),
    };
  }

  @Post("modifier-groups")
  @RequirePermission("menu.manage")
  @ApiBody({ type: CreateModifierGroupDto })
  @ZodResponse({ status: 201, type: MenuModifierGroupResponseDto })
  async createModifierGroup(
    @Req() request: AuthenticatedRequest,
    @Body() body: CreateModifierGroupDto,
  ) {
    return {
      group: await this.menuCatalogService.createModifierGroup(request.businessId!, body),
    };
  }

  @Patch("modifier-groups/:groupId")
  @RequirePermission("menu.manage")
  @ApiParam({ name: "groupId" })
  @ApiBody({ type: UpdateModifierGroupDto })
  @ZodResponse({ status: 200, type: MenuModifierGroupResponseDto })
  async updateModifierGroup(
    @Req() request: AuthenticatedRequest,
    @Param("groupId") groupId: string,
    @Body() body: UpdateModifierGroupDto,
  ) {
    return {
      group: await this.menuCatalogService.updateModifierGroup(
        request.businessId!,
        groupId,
        body,
      ),
    };
  }

  @Delete("modifier-groups/:groupId")
  @RequirePermission("menu.manage")
  @ApiParam({ name: "groupId" })
  @ZodResponse({ status: 200, type: MenuDeleteResponseDto })
  async deleteModifierGroup(
    @Req() request: AuthenticatedRequest,
    @Param("groupId") groupId: string,
  ) {
    await this.menuCatalogService.softDeleteModifierGroup(request.businessId!, groupId);
    return { deleted: true as const };
  }

  @Get("tags")
  @RequirePermission("menu.view")
  @ApiOperation({ summary: "List business dietary and allergen tags." })
  @ZodResponse({ status: 200, type: MenuTagsResponseDto })
  async listTags(@Req() request: AuthenticatedRequest) {
    return { tags: await this.menuCatalogService.listTags(request.businessId!) };
  }

  @Post("tags")
  @RequirePermission("menu.manage")
  @ApiBody({ type: CreateDietaryTagDto })
  @ZodResponse({ status: 201, type: MenuTagResponseDto })
  async createTag(
    @Req() request: AuthenticatedRequest,
    @Body() body: CreateDietaryTagDto,
  ) {
    return { tag: await this.menuCatalogService.createTag(request.businessId!, body) };
  }

  @Patch("tags/:tagId")
  @RequirePermission("menu.manage")
  @ApiParam({ name: "tagId" })
  @ApiBody({ type: UpdateDietaryTagDto })
  @ZodResponse({ status: 200, type: MenuTagResponseDto })
  async updateTag(
    @Req() request: AuthenticatedRequest,
    @Param("tagId") tagId: string,
    @Body() body: UpdateDietaryTagDto,
  ) {
    return { tag: await this.menuCatalogService.updateTag(request.businessId!, tagId, body) };
  }

  @Delete("tags/:tagId")
  @RequirePermission("menu.manage")
  @ApiParam({ name: "tagId" })
  @ZodResponse({ status: 200, type: MenuDeleteResponseDto })
  async deleteTag(
    @Req() request: AuthenticatedRequest,
    @Param("tagId") tagId: string,
  ) {
    await this.menuCatalogService.deleteTag(request.businessId!, tagId);
    return { deleted: true as const };
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

  @Put("products/:productId/modifier-groups")
  @RequirePermission("menu.manage")
  @ApiParam({ name: "productId" })
  @ApiBody({ type: AttachModifierGroupsDto })
  @ZodResponse({ status: 200, type: MenuEffectiveModifierGroupsResponseDto })
  async attachModifierGroupsToProduct(
    @Req() request: AuthenticatedRequest,
    @Param("productId") productId: string,
    @Body() body: AttachModifierGroupsDto,
  ) {
    return {
      groups: await this.menuCatalogService.attachModifierGroupsToProduct(
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

  @Put("products/:productId/tags")
  @RequirePermission("menu.manage")
  @ApiParam({ name: "productId" })
  @ApiBody({ type: ReplaceProductTagsDto })
  @ZodResponse({ status: 200, type: MenuTagsResponseDto })
  async replaceProductTags(
    @Req() request: AuthenticatedRequest,
    @Param("productId") productId: string,
    @Body() body: ReplaceProductTagsDto,
  ) {
    return {
      tags: await this.menuCatalogService.replaceProductTags(
        request.businessId!,
        productId,
        body,
      ),
    };
  }

  @Put("products/:productId/availability-windows")
  @RequirePermission("menu.manage")
  @ApiParam({ name: "productId" })
  @ApiBody({ type: ReplaceProductAvailabilityWindowsDto })
  @ZodResponse({ status: 200, type: MenuAvailabilityWindowsResponseDto })
  async replaceProductAvailabilityWindows(
    @Req() request: AuthenticatedRequest,
    @Param("productId") productId: string,
    @Body() body: ReplaceProductAvailabilityWindowsDto,
  ) {
    return {
      windows: await this.menuCatalogService.replaceAvailabilityWindows(
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
