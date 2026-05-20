import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { branchTaxSettings, branches, taxRates } from "@quickarte/db-schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import {
  DatabaseService,
  type TenantedDrizzleClient,
} from "../database/database.service";
import type {
  BranchTaxConfigPutBodyDto,
  BranchTaxConfigResponseDto,
  TaxRateResponseDto,
} from "./tax-config.dto";

const DEFAULT_RESTAURANT_TAX_RATE_ID = "ma_tva_10";
const DEFAULT_TAX_APPLICATION_LEVEL = "category";
const DEFAULT_PRICE_DISPLAY_MODE = "ttc";

@Injectable()
export class TaxConfigService {
  constructor(
    @Inject(DatabaseService) private readonly databaseService: DatabaseService,
  ) {}

  async listRates(businessId: string): Promise<TaxRateResponseDto[]> {
    return this.databaseService.withTenant(businessId, async (tx) => {
      const rows = await tx
        .select()
        .from(taxRates)
        .where(eq(taxRates.isActive, true))
        .orderBy(taxRates.rate, taxRates.id);
      return rows.map((row) => ({
        id: row.id,
        countryCode: row.countryCode,
        label: row.label,
        rate: Number(row.rate),
        isActive: row.isActive,
      }));
    });
  }

  async getBranchConfig(
    businessId: string,
    branchId: string,
  ): Promise<BranchTaxConfigResponseDto> {
    return this.databaseService.withTenant(businessId, async (tx) => {
      await this.assertBranch(tx, businessId, branchId);

      const [row] = await tx
        .select()
        .from(branchTaxSettings)
        .where(
          and(
            eq(branchTaxSettings.businessId, businessId),
            eq(branchTaxSettings.branchId, branchId),
          ),
        )
        .limit(1);

      if (!row) {
        // Moroccan restaurant food defaults to TVA 10%; no row is backfilled
        // until the branch explicitly saves its tax settings.
        return {
          branchId,
          defaultTaxRateId: DEFAULT_RESTAURANT_TAX_RATE_ID,
          taxApplicationLevel: DEFAULT_TAX_APPLICATION_LEVEL,
          priceDisplayMode: DEFAULT_PRICE_DISPLAY_MODE,
          serviceChargeEnabled: false,
          serviceChargeRate: null,
          serviceChargeLabel: null,
          isDefaultPresentation: true,
        };
      }

      return this.toResponse(row, false);
    });
  }

  async upsertBranchConfig(
    businessId: string,
    branchId: string,
    input: BranchTaxConfigPutBodyDto,
  ): Promise<BranchTaxConfigResponseDto> {
    await this.databaseService.withTenant(businessId, async (tx) => {
      await this.assertBranch(tx, businessId, branchId);
      this.validateServiceCharge(input);

      const [rate] = await tx
        .select({ id: taxRates.id })
        .from(taxRates)
        .where(and(eq(taxRates.id, input.defaultTaxRateId), eq(taxRates.isActive, true)))
        .limit(1);
      if (!rate) {
        throw new BadRequestException({
          type: "https://api.quickarte.ma/problems/tax-rate-unknown",
          message: `Unknown or inactive tax rate: ${input.defaultTaxRateId}`,
        });
      }

      await tx
        .insert(branchTaxSettings)
        .values({
          businessId,
          branchId,
          defaultTaxRateId: input.defaultTaxRateId,
          taxApplicationLevel: input.taxApplicationLevel,
          priceDisplayMode: input.priceDisplayMode,
          serviceChargeEnabled: input.serviceChargeEnabled,
          serviceChargeRate: input.serviceChargeEnabled
            ? input.serviceChargeRate?.toFixed(2)
            : null,
          serviceChargeLabel: input.serviceChargeLabel?.trim() || null,
        })
        .onConflictDoUpdate({
          target: branchTaxSettings.branchId,
          set: {
            businessId,
            defaultTaxRateId: input.defaultTaxRateId,
            taxApplicationLevel: input.taxApplicationLevel,
            priceDisplayMode: input.priceDisplayMode,
            serviceChargeEnabled: input.serviceChargeEnabled,
            serviceChargeRate: input.serviceChargeEnabled
              ? input.serviceChargeRate?.toFixed(2)
              : null,
            serviceChargeLabel: input.serviceChargeLabel?.trim() || null,
            updatedAt: sql`now()`,
          },
        });
    });

    return this.getBranchConfig(businessId, branchId);
  }

  private validateServiceCharge(input: BranchTaxConfigPutBodyDto): void {
    const rate = input.serviceChargeRate;
    if (
      input.serviceChargeEnabled &&
      (rate === null || rate === undefined || rate < 0 || rate > 100)
    ) {
      throw new BadRequestException({
        type: "https://api.quickarte.ma/problems/service-charge-invalid",
        message: "Service charge rate is required and must be between 0 and 100.",
      });
    }
    if (!input.serviceChargeEnabled && rate !== null && rate !== undefined && (rate < 0 || rate > 100)) {
      throw new BadRequestException({
        type: "https://api.quickarte.ma/problems/service-charge-invalid",
        message: "Service charge rate must be between 0 and 100.",
      });
    }
  }

  private async assertBranch(
    tx: TenantedDrizzleClient,
    businessId: string,
    branchId: string,
  ): Promise<void> {
    const [branch] = await tx
      .select({ id: branches.id })
      .from(branches)
      .where(
        and(
          eq(branches.businessId, businessId),
          eq(branches.id, branchId),
          isNull(branches.deletedAt),
        ),
      )
      .limit(1);

    if (!branch) {
      throw new NotFoundException("Branch not found");
    }
  }

  private toResponse(
    row: typeof branchTaxSettings.$inferSelect,
    isDefaultPresentation: boolean,
  ): BranchTaxConfigResponseDto {
    return {
      branchId: row.branchId,
      defaultTaxRateId: row.defaultTaxRateId,
      taxApplicationLevel: row.taxApplicationLevel as BranchTaxConfigResponseDto["taxApplicationLevel"],
      priceDisplayMode: row.priceDisplayMode as BranchTaxConfigResponseDto["priceDisplayMode"],
      serviceChargeEnabled: row.serviceChargeEnabled,
      serviceChargeRate: row.serviceChargeRate === null ? null : Number(row.serviceChargeRate),
      serviceChargeLabel: row.serviceChargeLabel,
      isDefaultPresentation,
    };
  }
}
