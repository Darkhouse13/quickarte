import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  branches,
  businesses,
  businessLegalProfiles,
  type Branch,
  type Business,
  type BusinessLegalProfile,
} from "@quickarte/db-schema";
import { and, eq, isNull } from "drizzle-orm";
import { DatabaseService } from "../database/database.service";

export type BusinessSetupUpdateInput = {
  name?: string;
  type?: "restaurant" | "cafe" | "autre";
  currency?: string;
  secondaryCurrency?: string | null;
  timezone?: string;
  locale?: string;
  logo?: string | null;
  legalProfile?: {
    legalName?: string;
    iceNumber?: string | null;
    rcNumber?: string | null;
    ifNumber?: string | null;
    patenteNumber?: string | null;
    cnssNumber?: string | null;
    legalAddress?: string | null;
    legalCity?: string | null;
    legalPostcode?: string | null;
  };
};

export type BusinessSetup = {
  business: Business;
  legalProfile: BusinessLegalProfile | null;
  defaultBranch: Branch | null;
};

@Injectable()
export class BusinessesSetupService {
  constructor(
    @Inject(DatabaseService) private readonly databaseService: DatabaseService,
  ) {}

  async getSetup(businessId: string): Promise<BusinessSetup> {
    return this.databaseService.withTenant(businessId, async (tx) => {
      const [business] = await tx
        .select()
        .from(businesses)
        .where(eq(businesses.id, businessId))
        .limit(1);

      if (!business) {
        throw new NotFoundException("Business not found");
      }

      const [legalProfile] = await tx
        .select()
        .from(businessLegalProfiles)
        .where(eq(businessLegalProfiles.businessId, businessId))
        .limit(1);

      const [defaultBranch] = await tx
        .select()
        .from(branches)
        .where(
          and(
            eq(branches.businessId, businessId),
            eq(branches.isDefault, true),
            isNull(branches.deletedAt),
          ),
        )
        .limit(1);

      return {
        business,
        legalProfile: legalProfile ?? null,
        defaultBranch: defaultBranch ?? null,
      };
    });
  }

  async updateSetup(
    businessId: string,
    input: BusinessSetupUpdateInput,
  ): Promise<BusinessSetup> {
    return this.databaseService.withTenant(businessId, async (tx) => {
      const businessUpdates = {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.secondaryCurrency !== undefined
          ? { secondaryCurrency: input.secondaryCurrency }
          : {}),
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
        ...(input.locale !== undefined ? { locale: input.locale } : {}),
        ...(input.logo !== undefined ? { logo: input.logo } : {}),
        updatedAt: new Date(),
      };

      const [business] = await tx
        .update(businesses)
        .set(businessUpdates)
        .where(eq(businesses.id, businessId))
        .returning();

      if (!business) {
        throw new NotFoundException("Business not found");
      }

      if (input.legalProfile) {
        const [existing] = await tx
          .select()
          .from(businessLegalProfiles)
          .where(eq(businessLegalProfiles.businessId, businessId))
          .limit(1);

        if (!existing && !input.legalProfile.legalName) {
          throw new BadRequestException({
            message: "legalProfile.legalName is required when creating a legal profile.",
          });
        }

        await tx
          .insert(businessLegalProfiles)
          .values({
            businessId,
            legalName: input.legalProfile.legalName ?? existing!.legalName,
            iceNumber: input.legalProfile.iceNumber ?? existing?.iceNumber ?? null,
            rcNumber: input.legalProfile.rcNumber ?? existing?.rcNumber ?? null,
            ifNumber: input.legalProfile.ifNumber ?? existing?.ifNumber ?? null,
            patenteNumber:
              input.legalProfile.patenteNumber ?? existing?.patenteNumber ?? null,
            cnssNumber: input.legalProfile.cnssNumber ?? existing?.cnssNumber ?? null,
            legalAddress:
              input.legalProfile.legalAddress ?? existing?.legalAddress ?? null,
            legalCity: input.legalProfile.legalCity ?? existing?.legalCity ?? null,
            legalPostcode:
              input.legalProfile.legalPostcode ?? existing?.legalPostcode ?? null,
          })
          .onConflictDoUpdate({
            target: businessLegalProfiles.businessId,
            set: {
              legalName: input.legalProfile.legalName ?? existing!.legalName,
              iceNumber: input.legalProfile.iceNumber ?? existing?.iceNumber ?? null,
              rcNumber: input.legalProfile.rcNumber ?? existing?.rcNumber ?? null,
              ifNumber: input.legalProfile.ifNumber ?? existing?.ifNumber ?? null,
              patenteNumber:
                input.legalProfile.patenteNumber ?? existing?.patenteNumber ?? null,
              cnssNumber: input.legalProfile.cnssNumber ?? existing?.cnssNumber ?? null,
              legalAddress:
                input.legalProfile.legalAddress ?? existing?.legalAddress ?? null,
              legalCity: input.legalProfile.legalCity ?? existing?.legalCity ?? null,
              legalPostcode:
                input.legalProfile.legalPostcode ?? existing?.legalPostcode ?? null,
              updatedAt: new Date(),
            },
          });
      }

      const [legalProfile] = await tx
        .select()
        .from(businessLegalProfiles)
        .where(eq(businessLegalProfiles.businessId, businessId))
        .limit(1);

      const [defaultBranch] = await tx
        .select()
        .from(branches)
        .where(
          and(
            eq(branches.businessId, businessId),
            eq(branches.isDefault, true),
            isNull(branches.deletedAt),
          ),
        )
        .limit(1);

      return {
        business,
        legalProfile: legalProfile ?? null,
        defaultBranch: defaultBranch ?? null,
      };
    });
  }
}
