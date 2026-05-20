import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Req,
} from "@nestjs/common";
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiPropertyOptional,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import {
  IsEmail,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
} from "class-validator";
import type { Branch } from "@quickarte/db-schema";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import type { AuthenticatedRequest } from "../common/middleware/tenant-context.middleware";
import { BranchListResponseDto, BranchResponseDto } from "./branch.dto";
import { BranchesService } from "./branches.service";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

class BranchBody {
  @ApiProperty({ type: String, maxLength: 120 })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ type: String, maxLength: 80, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" })
  @IsString()
  @MaxLength(80)
  @Matches(SLUG_PATTERN)
  slug!: string;

  @ApiPropertyOptional({ type: String, enum: ["active", "inactive"] })
  @IsOptional()
  @IsIn(["active", "inactive"])
  status?: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  addressLine1?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  addressLine2?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  city?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 16 })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  postcode?: string | null;

  @ApiPropertyOptional({ type: String, maxLength: 2, default: "MA" })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  countryCode?: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  googlePlaceId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  formattedAddress?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  lat?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  lng?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  phone?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: "email" })
  @IsOptional()
  @IsEmail()
  email?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: "uri" })
  @IsOptional()
  @IsUrl({ require_tld: false })
  website?: string | null;

  @ApiPropertyOptional({ nullable: true, type: "object", additionalProperties: true })
  @IsOptional()
  @IsObject()
  socialLinks?: Record<string, unknown>;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  logo?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  cuisineType?: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  seatingCapacity?: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  currency?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  timezone?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  locale?: string | null;
}

class UpdateBranchBody {
  @ApiPropertyOptional({ type: String, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ type: String, maxLength: 80, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Matches(SLUG_PATTERN)
  slug?: string;

  @ApiPropertyOptional({ type: String, enum: ["active", "inactive"] })
  @IsOptional()
  @IsIn(["active", "inactive"])
  status?: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  addressLine1?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  addressLine2?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  city?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 16 })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  postcode?: string | null;

  @ApiPropertyOptional({ type: String, maxLength: 2 })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  countryCode?: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  googlePlaceId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  formattedAddress?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  lat?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  lng?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  phone?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: "email" })
  @IsOptional()
  @IsEmail()
  email?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: "uri" })
  @IsOptional()
  @IsUrl({ require_tld: false })
  website?: string | null;

  @ApiPropertyOptional({ nullable: true, type: "object", additionalProperties: true })
  @IsOptional()
  @IsObject()
  socialLinks?: Record<string, unknown>;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  logo?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  cuisineType?: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  seatingCapacity?: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  currency?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  timezone?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  locale?: string | null;
}

@ApiTags("Branches")
@Controller("branches")
export class BranchesController {
  constructor(
    @Inject(BranchesService) private readonly branchesService: BranchesService,
  ) {}

  @Get()
  @RequirePermission("branch.view")
  @ApiOperation({ summary: "List branches for the current business" })
  @ApiResponse({ status: 200, description: "Tenant branch list.", type: BranchListResponseDto })
  async list(
    @Req() request: AuthenticatedRequest,
  ): Promise<BranchListResponseDto> {
    const rows = await this.branchesService.list(request.businessId!);
    return { branches: rows.map(toBranchResponse) };
  }

  @Post()
  @RequirePermission("branch.create")
  @ApiOperation({ summary: "Create a branch" })
  @ApiBody({ type: BranchBody })
  @ApiResponse({ status: 201, description: "Created branch.", type: BranchResponseDto })
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() body: BranchBody,
  ): Promise<BranchResponseDto> {
    const branch = await this.branchesService.create(request.businessId!, body);
    return toBranchResponse(branch);
  }

  @Get(":branchId")
  @RequirePermission("branch.view")
  @ApiOperation({ summary: "Get a branch" })
  @ApiParam({ name: "branchId", format: "uuid" })
  @ApiResponse({ status: 200, description: "Branch profile.", type: BranchResponseDto })
  @ApiResponse({ status: 404, description: "Branch not found." })
  async get(
    @Req() request: AuthenticatedRequest,
    @Param("branchId") branchId: string,
  ): Promise<BranchResponseDto> {
    const branch = await this.branchesService.findOne(request.businessId!, branchId);
    return toBranchResponse(branch);
  }

  @Patch(":branchId")
  @RequirePermission("branch.update")
  @ApiOperation({ summary: "Update a branch" })
  @ApiParam({ name: "branchId", format: "uuid" })
  @ApiBody({ type: UpdateBranchBody })
  @ApiResponse({ status: 200, description: "Updated branch.", type: BranchResponseDto })
  async update(
    @Req() request: AuthenticatedRequest,
    @Param("branchId") branchId: string,
    @Body() body: UpdateBranchBody,
  ): Promise<BranchResponseDto> {
    const branch = await this.branchesService.update(request.businessId!, branchId, body);
    return toBranchResponse(branch);
  }

  @Post(":branchId/set-default")
  @HttpCode(200)
  @RequirePermission("branch.update")
  @ApiOperation({ summary: "Set branch as default" })
  @ApiParam({ name: "branchId", format: "uuid" })
  @ApiResponse({ status: 200, description: "Default branch updated.", type: BranchResponseDto })
  async setDefault(
    @Req() request: AuthenticatedRequest,
    @Param("branchId") branchId: string,
  ): Promise<BranchResponseDto> {
    const branch = await this.branchesService.setDefault(request.businessId!, branchId);
    return toBranchResponse(branch);
  }

  @Delete(":branchId")
  @HttpCode(204)
  @RequirePermission("branch.delete")
  @ApiOperation({ summary: "Deactivate a branch" })
  @ApiParam({ name: "branchId", format: "uuid" })
  @ApiResponse({ status: 204, description: "Branch deactivated." })
  async delete(
    @Req() request: AuthenticatedRequest,
    @Param("branchId") branchId: string,
  ): Promise<void> {
    await this.branchesService.softDelete(request.businessId!, branchId);
  }
}

function toBranchResponse(branch: Branch) {
  return {
    id: branch.id,
    businessId: branch.businessId,
    name: branch.name,
    slug: branch.slug,
    isDefault: branch.isDefault,
    status: branch.status,
    addressLine1: branch.addressLine1,
    addressLine2: branch.addressLine2,
    city: branch.city,
    postcode: branch.postcode,
    countryCode: branch.countryCode,
    googlePlaceId: branch.googlePlaceId,
    formattedAddress: branch.formattedAddress,
    lat: branch.lat,
    lng: branch.lng,
    phone: branch.phone,
    email: branch.email,
    website: branch.website,
    socialLinks: branch.socialLinks,
    logo: branch.logo,
    cuisineType: branch.cuisineType,
    seatingCapacity: branch.seatingCapacity,
    currency: branch.currency,
    timezone: branch.timezone,
    locale: branch.locale,
    createdAt: branch.createdAt.toISOString(),
    updatedAt: branch.updatedAt.toISOString(),
  };
}
