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
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
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
import { BranchesService } from "./branches.service";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

class BranchBody {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(80)
  @Matches(SLUG_PATTERN)
  slug!: string;

  @IsOptional()
  @IsIn(["active", "inactive"])
  status?: string;

  @IsOptional()
  @IsString()
  addressLine1?: string | null;

  @IsOptional()
  @IsString()
  addressLine2?: string | null;

  @IsOptional()
  @IsString()
  city?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  postcode?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  countryCode?: string;

  @IsOptional()
  @IsString()
  googlePlaceId?: string | null;

  @IsOptional()
  @IsString()
  formattedAddress?: string | null;

  @IsOptional()
  @IsString()
  lat?: string | null;

  @IsOptional()
  @IsString()
  lng?: string | null;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @IsUrl({ require_tld: false })
  website?: string | null;

  @IsOptional()
  @IsObject()
  socialLinks?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  logo?: string | null;

  @IsOptional()
  @IsString()
  cuisineType?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  seatingCapacity?: number | null;

  @IsOptional()
  @IsString()
  currency?: string | null;

  @IsOptional()
  @IsString()
  timezone?: string | null;

  @IsOptional()
  @IsString()
  locale?: string | null;
}

class UpdateBranchBody {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Matches(SLUG_PATTERN)
  slug?: string;

  @IsOptional()
  @IsIn(["active", "inactive"])
  status?: string;

  @IsOptional()
  @IsString()
  addressLine1?: string | null;

  @IsOptional()
  @IsString()
  addressLine2?: string | null;

  @IsOptional()
  @IsString()
  city?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  postcode?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  countryCode?: string;

  @IsOptional()
  @IsString()
  googlePlaceId?: string | null;

  @IsOptional()
  @IsString()
  formattedAddress?: string | null;

  @IsOptional()
  @IsString()
  lat?: string | null;

  @IsOptional()
  @IsString()
  lng?: string | null;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @IsUrl({ require_tld: false })
  website?: string | null;

  @IsOptional()
  @IsObject()
  socialLinks?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  logo?: string | null;

  @IsOptional()
  @IsString()
  cuisineType?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  seatingCapacity?: number | null;

  @IsOptional()
  @IsString()
  currency?: string | null;

  @IsOptional()
  @IsString()
  timezone?: string | null;

  @IsOptional()
  @IsString()
  locale?: string | null;
}

type BranchResponse = ReturnType<typeof toBranchResponse>;

@ApiTags("Branches")
@Controller("branches")
export class BranchesController {
  constructor(
    @Inject(BranchesService) private readonly branchesService: BranchesService,
  ) {}

  @Get()
  @RequirePermission("branch.view")
  @ApiOperation({ summary: "List branches for the current business" })
  @ApiResponse({ status: 200, description: "Tenant branch list." })
  async list(
    @Req() request: AuthenticatedRequest,
  ): Promise<{ branches: BranchResponse[] }> {
    const rows = await this.branchesService.list(request.businessId!);
    return { branches: rows.map(toBranchResponse) };
  }

  @Post()
  @RequirePermission("branch.create")
  @ApiOperation({ summary: "Create a branch" })
  @ApiBody({
    schema: {
      type: "object",
      required: ["name", "slug"],
      properties: {
        name: { type: "string", maxLength: 120 },
        slug: { type: "string", maxLength: 80, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" },
        status: { type: "string", enum: ["active", "inactive"] },
        addressLine1: { type: "string", nullable: true },
        addressLine2: { type: "string", nullable: true },
        city: { type: "string", nullable: true },
        postcode: { type: "string", nullable: true, maxLength: 16 },
        countryCode: { type: "string", maxLength: 2, default: "MA" },
        googlePlaceId: { type: "string", nullable: true },
        formattedAddress: { type: "string", nullable: true },
        lat: { type: "string", nullable: true },
        lng: { type: "string", nullable: true },
        phone: { type: "string", nullable: true },
        email: { type: "string", nullable: true, format: "email" },
        website: { type: "string", nullable: true, format: "uri" },
        socialLinks: { type: "object", additionalProperties: true, nullable: true },
        logo: { type: "string", nullable: true },
        cuisineType: { type: "string", nullable: true },
        seatingCapacity: { type: "integer", nullable: true, minimum: 0 },
        currency: { type: "string", nullable: true },
        timezone: { type: "string", nullable: true },
        locale: { type: "string", nullable: true },
      },
    },
  })
  @ApiResponse({ status: 201, description: "Created branch." })
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() body: BranchBody,
  ): Promise<BranchResponse> {
    const branch = await this.branchesService.create(request.businessId!, body);
    return toBranchResponse(branch);
  }

  @Get(":branchId")
  @RequirePermission("branch.view")
  @ApiOperation({ summary: "Get a branch" })
  @ApiResponse({ status: 200, description: "Branch profile." })
  @ApiResponse({ status: 404, description: "Branch not found." })
  async get(
    @Req() request: AuthenticatedRequest,
    @Param("branchId") branchId: string,
  ): Promise<BranchResponse> {
    const branch = await this.branchesService.findOne(request.businessId!, branchId);
    return toBranchResponse(branch);
  }

  @Patch(":branchId")
  @RequirePermission("branch.update")
  @ApiOperation({ summary: "Update a branch" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        name: { type: "string", maxLength: 120 },
        slug: { type: "string", maxLength: 80, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" },
        status: { type: "string", enum: ["active", "inactive"] },
        addressLine1: { type: "string", nullable: true },
        addressLine2: { type: "string", nullable: true },
        city: { type: "string", nullable: true },
        postcode: { type: "string", nullable: true, maxLength: 16 },
        countryCode: { type: "string", maxLength: 2 },
        googlePlaceId: { type: "string", nullable: true },
        formattedAddress: { type: "string", nullable: true },
        lat: { type: "string", nullable: true },
        lng: { type: "string", nullable: true },
        phone: { type: "string", nullable: true },
        email: { type: "string", nullable: true, format: "email" },
        website: { type: "string", nullable: true, format: "uri" },
        socialLinks: { type: "object", additionalProperties: true, nullable: true },
        logo: { type: "string", nullable: true },
        cuisineType: { type: "string", nullable: true },
        seatingCapacity: { type: "integer", nullable: true, minimum: 0 },
        currency: { type: "string", nullable: true },
        timezone: { type: "string", nullable: true },
        locale: { type: "string", nullable: true },
      },
    },
  })
  @ApiResponse({ status: 200, description: "Updated branch." })
  async update(
    @Req() request: AuthenticatedRequest,
    @Param("branchId") branchId: string,
    @Body() body: UpdateBranchBody,
  ): Promise<BranchResponse> {
    const branch = await this.branchesService.update(request.businessId!, branchId, body);
    return toBranchResponse(branch);
  }

  @Post(":branchId/set-default")
  @HttpCode(200)
  @RequirePermission("branch.update")
  @ApiOperation({ summary: "Set branch as default" })
  @ApiResponse({ status: 200, description: "Default branch updated." })
  async setDefault(
    @Req() request: AuthenticatedRequest,
    @Param("branchId") branchId: string,
  ): Promise<BranchResponse> {
    const branch = await this.branchesService.setDefault(request.businessId!, branchId);
    return toBranchResponse(branch);
  }

  @Delete(":branchId")
  @HttpCode(204)
  @RequirePermission("branch.delete")
  @ApiOperation({ summary: "Deactivate a branch" })
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
