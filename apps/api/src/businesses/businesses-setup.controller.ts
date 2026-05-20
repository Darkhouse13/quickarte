import { Body, Controller, Get, Inject, Patch, Req } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import type { AuthenticatedRequest } from "../common/middleware/tenant-context.middleware";
import {
  BusinessesSetupService,
  type BusinessSetup,
} from "./businesses-setup.service";

class LegalProfileBody {
  @IsOptional()
  @IsString()
  legalName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  iceNumber?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  rcNumber?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  ifNumber?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  patenteNumber?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  cnssNumber?: string | null;

  @IsOptional()
  @IsString()
  legalAddress?: string | null;

  @IsOptional()
  @IsString()
  legalCity?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  legalPostcode?: string | null;
}

class UpdateBusinessSetupBody {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(["restaurant", "cafe", "autre"])
  type?: "restaurant" | "cafe" | "autre";

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  secondaryCurrency?: string | null;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  locale?: string;

  @IsOptional()
  @IsString()
  logo?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => LegalProfileBody)
  legalProfile?: LegalProfileBody;
}

@ApiTags("Businesses")
@Controller("businesses/me/setup")
export class BusinessesSetupController {
  constructor(
    @Inject(BusinessesSetupService)
    private readonly businessesSetupService: BusinessesSetupService,
  ) {}

  @Get()
  @RequirePermission("business.view")
  @ApiOperation({ summary: "Get current business setup profile" })
  @ApiResponse({
    status: 200,
    description: "Business setup profile, legal profile, and default branch.",
  })
  async get(@Req() request: AuthenticatedRequest) {
    return toSetupResponse(
      await this.businessesSetupService.getSetup(request.businessId!),
    );
  }

  @Patch()
  @RequirePermission("business.update")
  @ApiOperation({ summary: "Update current business setup profile" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        type: { type: "string", enum: ["restaurant", "cafe", "autre"] },
        currency: { type: "string" },
        secondaryCurrency: { type: "string", nullable: true },
        timezone: { type: "string" },
        locale: { type: "string" },
        logo: { type: "string", nullable: true },
        legalProfile: {
          type: "object",
          properties: {
            legalName: { type: "string" },
            iceNumber: { type: "string", nullable: true, maxLength: 32 },
            rcNumber: { type: "string", nullable: true, maxLength: 32 },
            ifNumber: { type: "string", nullable: true, maxLength: 32 },
            patenteNumber: { type: "string", nullable: true, maxLength: 32 },
            cnssNumber: { type: "string", nullable: true, maxLength: 32 },
            legalAddress: { type: "string", nullable: true },
            legalCity: { type: "string", nullable: true },
            legalPostcode: { type: "string", nullable: true, maxLength: 16 },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: "Updated business setup profile.",
  })
  async update(
    @Req() request: AuthenticatedRequest,
    @Body() body: UpdateBusinessSetupBody,
  ) {
    return toSetupResponse(
      await this.businessesSetupService.updateSetup(request.businessId!, body),
    );
  }
}

function toSetupResponse(setup: BusinessSetup) {
  return {
    business: {
      id: setup.business.id,
      name: setup.business.name,
      slug: setup.business.slug,
      type: setup.business.type,
      city: setup.business.city,
      address: setup.business.address,
      logo: setup.business.logo,
      currency: setup.business.currency,
      secondaryCurrency: setup.business.secondaryCurrency,
      timezone: setup.business.timezone,
      locale: setup.business.locale,
    },
    legalProfile: setup.legalProfile
      ? {
          legalName: setup.legalProfile.legalName,
          iceNumber: setup.legalProfile.iceNumber,
          rcNumber: setup.legalProfile.rcNumber,
          ifNumber: setup.legalProfile.ifNumber,
          patenteNumber: setup.legalProfile.patenteNumber,
          cnssNumber: setup.legalProfile.cnssNumber,
          legalAddress: setup.legalProfile.legalAddress,
          legalCity: setup.legalProfile.legalCity,
          legalPostcode: setup.legalProfile.legalPostcode,
        }
      : null,
    defaultBranch: setup.defaultBranch
      ? {
          id: setup.defaultBranch.id,
          name: setup.defaultBranch.name,
          slug: setup.defaultBranch.slug,
          isDefault: setup.defaultBranch.isDefault,
        }
      : null,
  };
}
