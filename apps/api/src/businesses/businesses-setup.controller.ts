import { Body, Controller, Get, Inject, Patch, Req } from "@nestjs/common";
import {
  ApiBody,
  ApiOperation,
  ApiPropertyOptional,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
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
import { BusinessSetupResponseDto } from "./business-setup.dto";

class LegalProfileBody {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  legalName?: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 32 })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  iceNumber?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 32 })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  rcNumber?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 32 })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  ifNumber?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 32 })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  patenteNumber?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 32 })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  cnssNumber?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  legalAddress?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  legalCity?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 16 })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  legalPostcode?: string | null;
}

class UpdateBusinessSetupBody {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ type: String, enum: ["restaurant", "cafe", "autre"] })
  @IsOptional()
  @IsIn(["restaurant", "cafe", "autre"])
  type?: "restaurant" | "cafe" | "autre";

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  secondaryCurrency?: string | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  locale?: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  logo?: string | null;

  @ApiPropertyOptional({ type: () => LegalProfileBody })
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
    type: BusinessSetupResponseDto,
  })
  async get(@Req() request: AuthenticatedRequest): Promise<BusinessSetupResponseDto> {
    return toSetupResponse(
      await this.businessesSetupService.getSetup(request.businessId!),
    );
  }

  @Patch()
  @RequirePermission("business.update")
  @ApiOperation({ summary: "Update current business setup profile" })
  @ApiBody({ type: UpdateBusinessSetupBody })
  @ApiResponse({
    status: 200,
    description: "Updated business setup profile.",
    type: BusinessSetupResponseDto,
  })
  async update(
    @Req() request: AuthenticatedRequest,
    @Body() body: UpdateBusinessSetupBody,
  ): Promise<BusinessSetupResponseDto> {
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
