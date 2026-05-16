import { Controller, Get, NotFoundException, Req } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { TenantRequest } from "../common/middleware/tenant-context.middleware";
import { BusinessesService } from "./businesses.service";

type BusinessResponse = {
  id: string;
  name: string;
  slug: string;
  type: string;
  city: string | null;
  address: string | null;
  currency: string;
  timezone: string;
  locale: string;
};

@ApiTags("Businesses")
@Controller("businesses")
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @Get("me")
  @ApiOperation({ summary: "Get the current tenant business profile" })
  @ApiResponse({
    status: 200,
    description: "Current business profile for the tenant context.",
  })
  @ApiResponse({
    status: 404,
    description: "No business exists for the current tenant context.",
  })
  async getCurrentBusiness(@Req() request: TenantRequest): Promise<BusinessResponse> {
    const businessId = request.businessId;
    if (!businessId) {
      throw new NotFoundException("Business not found");
    }

    const business = await this.businessesService.findCurrent(businessId);
    if (!business) {
      throw new NotFoundException("Business not found");
    }

    return {
      id: business.id,
      name: business.name,
      slug: business.slug,
      type: business.type,
      city: business.city,
      address: business.address,
      currency: business.currency,
      timezone: business.timezone,
      locale: business.locale,
    };
  }
}
