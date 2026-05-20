import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { branches, type Branch, type NewBranch } from "@quickarte/db-schema";
import { and, count, eq, isNull } from "drizzle-orm";
import { DatabaseService } from "../database/database.service";

const PROBLEM_BASE_URL = "https://api.quickarte.ma/problems";

export type BranchInput = {
  name?: string;
  slug?: string;
  status?: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  postcode?: string | null;
  countryCode?: string;
  googlePlaceId?: string | null;
  formattedAddress?: string | null;
  lat?: string | null;
  lng?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  socialLinks?: unknown;
  logo?: string | null;
  cuisineType?: string | null;
  seatingCapacity?: number | null;
  currency?: string | null;
  timezone?: string | null;
  locale?: string | null;
};

@Injectable()
export class BranchesService {
  constructor(
    @Inject(DatabaseService) private readonly databaseService: DatabaseService,
  ) {}

  async list(businessId: string): Promise<Branch[]> {
    return this.databaseService.withTenant(businessId, (tx) =>
      tx
        .select()
        .from(branches)
        .where(and(eq(branches.businessId, businessId), isNull(branches.deletedAt)))
        .orderBy(branches.isDefault, branches.name),
    );
  }

  async findOne(businessId: string, branchId: string): Promise<Branch> {
    const branch = await this.databaseService.withTenant(businessId, async (tx) => {
      const [row] = await tx
        .select()
        .from(branches)
        .where(
          and(
            eq(branches.businessId, businessId),
            eq(branches.id, branchId),
            isNull(branches.deletedAt),
          ),
        )
        .limit(1);
      return row;
    });

    if (!branch) {
      throw new NotFoundException("Branch not found");
    }
    return branch;
  }

  async create(businessId: string, input: Required<Pick<BranchInput, "name" | "slug">> & BranchInput): Promise<Branch> {
    return this.databaseService.withTenant(businessId, async (tx) => {
      const [existing] = await tx
        .select({ id: branches.id })
        .from(branches)
        .where(
          and(
            eq(branches.businessId, businessId),
            eq(branches.slug, input.slug),
            isNull(branches.deletedAt),
          ),
        )
        .limit(1);

      if (existing) {
        throw new ConflictException({
          type: `${PROBLEM_BASE_URL}/branch-slug-conflict`,
          message: "A branch with this slug already exists.",
        });
      }

      const [created] = await tx
        .insert(branches)
        .values(this.toInsertValues(businessId, input))
        .returning();

      if (!created) {
        throw new Error("Branch creation failed");
      }
      return created;
    });
  }

  async update(businessId: string, branchId: string, input: BranchInput): Promise<Branch> {
    return this.databaseService.withTenant(businessId, async (tx) => {
      const [existing] = await tx
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

      if (!existing) {
        throw new NotFoundException("Branch not found");
      }

      if (input.slug) {
        const [slugConflict] = await tx
          .select({ id: branches.id })
          .from(branches)
          .where(
            and(
              eq(branches.businessId, businessId),
              eq(branches.slug, input.slug),
              isNull(branches.deletedAt),
            ),
          )
          .limit(1);
        if (slugConflict && slugConflict.id !== branchId) {
          throw new ConflictException({
            type: `${PROBLEM_BASE_URL}/branch-slug-conflict`,
            message: "A branch with this slug already exists.",
          });
        }
      }

      const [updated] = await tx
        .update(branches)
        .set({ ...this.toUpdateValues(input), updatedAt: new Date() })
        .where(and(eq(branches.businessId, businessId), eq(branches.id, branchId)))
        .returning();

      if (!updated) {
        throw new NotFoundException("Branch not found");
      }
      return updated;
    });
  }

  async setDefault(businessId: string, branchId: string): Promise<Branch> {
    return this.databaseService.withTenant(businessId, async (tx) => {
      const [target] = await tx
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

      if (!target) {
        throw new NotFoundException("Branch not found");
      }

      await tx
        .update(branches)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(and(eq(branches.businessId, businessId), isNull(branches.deletedAt)));

      const [updated] = await tx
        .update(branches)
        .set({ isDefault: true, updatedAt: new Date() })
        .where(and(eq(branches.businessId, businessId), eq(branches.id, branchId)))
        .returning();

      if (!updated) {
        throw new NotFoundException("Branch not found");
      }
      return updated;
    });
  }

  async softDelete(businessId: string, branchId: string): Promise<void> {
    await this.databaseService.withTenant(businessId, async (tx) => {
      const [target] = await tx
        .select({ id: branches.id, isDefault: branches.isDefault })
        .from(branches)
        .where(
          and(
            eq(branches.businessId, businessId),
            eq(branches.id, branchId),
            isNull(branches.deletedAt),
          ),
        )
        .limit(1);

      if (!target) {
        throw new NotFoundException("Branch not found");
      }

      const [activeCount] = await tx
        .select({ value: count() })
        .from(branches)
        .where(and(eq(branches.businessId, businessId), isNull(branches.deletedAt)));

      if ((activeCount?.value ?? 0) <= 1) {
        throw new ConflictException({
          type: `${PROBLEM_BASE_URL}/last-branch-delete`,
          message: "A business must keep at least one active branch.",
        });
      }

      if (target.isDefault) {
        throw new ConflictException({
          type: `${PROBLEM_BASE_URL}/default-branch-delete`,
          message: "Set another branch as default before deactivating this branch.",
        });
      }

      await tx
        .update(branches)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(branches.businessId, businessId), eq(branches.id, branchId)));
    });
  }

  private toInsertValues(businessId: string, input: Required<Pick<BranchInput, "name" | "slug">> & BranchInput): NewBranch {
    return {
      businessId,
      name: input.name,
      slug: input.slug,
      status: input.status ?? "active",
      addressLine1: input.addressLine1 ?? null,
      addressLine2: input.addressLine2 ?? null,
      city: input.city ?? null,
      postcode: input.postcode ?? null,
      countryCode: input.countryCode ?? "MA",
      googlePlaceId: input.googlePlaceId ?? null,
      formattedAddress: input.formattedAddress ?? null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      website: input.website ?? null,
      socialLinks: input.socialLinks ?? null,
      logo: input.logo ?? null,
      cuisineType: input.cuisineType ?? null,
      seatingCapacity: input.seatingCapacity ?? null,
      currency: input.currency ?? null,
      timezone: input.timezone ?? null,
      locale: input.locale ?? null,
    };
  }

  private toUpdateValues(input: BranchInput): Partial<NewBranch> {
    return Object.fromEntries(
      Object.entries(input).filter(([, value]) => value !== undefined),
    ) as Partial<NewBranch>;
  }
}
