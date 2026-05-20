import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  branchClosedDays,
  branchOperatingHours,
  branchScheduleSettings,
  branches,
} from "@quickarte/db-schema";
import { and, eq, isNull } from "drizzle-orm";
import { DatabaseService, type TenantedDrizzleClient } from "../database/database.service";
import type {
  ClosedDayInputDto,
  OperatingHourInputDto,
  OperatingHoursPutBodyDto,
  OperatingHoursResponseDto,
} from "./operating-hours.dto";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

@Injectable()
export class OperatingHoursService {
  constructor(
    @Inject(DatabaseService) private readonly databaseService: DatabaseService,
  ) {}

  async get(businessId: string, branchId: string): Promise<OperatingHoursResponseDto> {
    return this.databaseService.withTenant(businessId, async (tx) => {
      await this.assertBranch(tx, businessId, branchId);

      const [settings] = await tx
        .select()
        .from(branchScheduleSettings)
        .where(eq(branchScheduleSettings.branchId, branchId))
        .limit(1);

      const hours = await tx
        .select()
        .from(branchOperatingHours)
        .where(and(eq(branchOperatingHours.businessId, businessId), eq(branchOperatingHours.branchId, branchId)))
        .orderBy(
          branchOperatingHours.scheduleType,
          branchOperatingHours.dayOfWeek,
          branchOperatingHours.position,
        );

      const closedDays = await tx
        .select()
        .from(branchClosedDays)
        .where(and(eq(branchClosedDays.businessId, businessId), eq(branchClosedDays.branchId, branchId)))
        .orderBy(branchClosedDays.date);

      return {
        branchId,
        ramadanModeEnabled: settings?.ramadanModeEnabled ?? false,
        normal: hours
          .filter((row) => row.scheduleType === "normal")
          .map((row) => ({
            id: row.id,
            scheduleType: "normal" as const,
            dayOfWeek: row.dayOfWeek,
            opensAt: row.opensAt,
            closesAt: row.closesAt,
            isClosed: row.isClosed,
            position: row.position,
          })),
        ramadan: hours
          .filter((row) => row.scheduleType === "ramadan")
          .map((row) => ({
            id: row.id,
            scheduleType: "ramadan" as const,
            dayOfWeek: row.dayOfWeek,
            opensAt: row.opensAt,
            closesAt: row.closesAt,
            isClosed: row.isClosed,
            position: row.position,
          })),
        closedDays: closedDays.map((row) => ({
          id: row.id,
          date: row.date,
          reason: row.reason,
        })),
      };
    });
  }

  async replace(
    businessId: string,
    branchId: string,
    input: OperatingHoursPutBodyDto,
  ): Promise<OperatingHoursResponseDto> {
    this.validateSchedules(input.normal, "normal");
    this.validateSchedules(input.ramadan, "ramadan");

    await this.databaseService.withTenant(businessId, async (tx) => {
      await this.assertBranch(tx, businessId, branchId);

      await tx
        .delete(branchOperatingHours)
        .where(and(eq(branchOperatingHours.businessId, businessId), eq(branchOperatingHours.branchId, branchId)));
      await tx
        .delete(branchClosedDays)
        .where(and(eq(branchClosedDays.businessId, businessId), eq(branchClosedDays.branchId, branchId)));

      const allHours = [
        ...input.normal.map((row) => this.toHourRow(businessId, branchId, "normal" as const, row)),
        ...input.ramadan.map((row) => this.toHourRow(businessId, branchId, "ramadan" as const, row)),
      ];

      if (allHours.length > 0) {
        await tx.insert(branchOperatingHours).values(allHours);
      }

      if (input.closedDays.length > 0) {
        await tx.insert(branchClosedDays).values(
          input.closedDays.map((row) => this.toClosedDayRow(businessId, branchId, row)),
        );
      }

      await tx
        .insert(branchScheduleSettings)
        .values({
          branchId,
          businessId,
          ramadanModeEnabled: input.ramadanModeEnabled,
        })
        .onConflictDoUpdate({
          target: branchScheduleSettings.branchId,
          set: {
            businessId,
            ramadanModeEnabled: input.ramadanModeEnabled,
            updatedAt: new Date(),
          },
        });
    });

    return this.get(businessId, branchId);
  }

  private validateSchedules(rows: OperatingHourInputDto[], scheduleType: "normal" | "ramadan"): void {
    const seen = new Set<string>();
    for (const row of rows) {
      const key = `${row.dayOfWeek}:${row.position}`;
      if (seen.has(key)) {
        throw new BadRequestException({
          type: "https://api.quickarte.ma/problems/operating-hours-duplicate-position",
          message: `Duplicate ${scheduleType} interval for day ${row.dayOfWeek} position ${row.position}.`,
        });
      }

      if (row.isClosed && (row.opensAt != null || row.closesAt != null)) {
        throw new BadRequestException({
          type: "https://api.quickarte.ma/problems/operating-hours-invalid-times",
          message: `Closed ${scheduleType} interval for day ${row.dayOfWeek} position ${row.position} must not include times.`,
        });
      }

      const opensAt = row.opensAt;
      const closesAt = row.closesAt;

      if (!row.isClosed && (!opensAt || !closesAt)) {
        throw new BadRequestException({
          type: "https://api.quickarte.ma/problems/operating-hours-invalid-times",
          message: `Open ${scheduleType} interval for day ${row.dayOfWeek} position ${row.position} requires opensAt and closesAt.`,
        });
      }

      if (!row.isClosed && opensAt && closesAt && (!TIME_PATTERN.test(opensAt) || !TIME_PATTERN.test(closesAt))) {
        throw new BadRequestException({
          type: "https://api.quickarte.ma/problems/operating-hours-invalid-times",
          message: `Open ${scheduleType} interval for day ${row.dayOfWeek} position ${row.position} must use HH:mm times.`,
        });
      }

      seen.add(key);
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
      .where(and(eq(branches.businessId, businessId), eq(branches.id, branchId), isNull(branches.deletedAt)))
      .limit(1);

    if (!branch) {
      throw new NotFoundException("Branch not found");
    }
  }

  private toHourRow(
    businessId: string,
    branchId: string,
    scheduleType: "normal" | "ramadan",
    row: OperatingHourInputDto,
  ) {
    return {
      businessId,
      branchId,
      scheduleType,
      dayOfWeek: row.dayOfWeek,
      opensAt: row.isClosed ? null : row.opensAt!,
      closesAt: row.isClosed ? null : row.closesAt!,
      isClosed: row.isClosed,
      position: row.position,
    };
  }

  private toClosedDayRow(
    businessId: string,
    branchId: string,
    row: ClosedDayInputDto,
  ) {
    return {
      businessId,
      branchId,
      date: row.date,
      reason: row.reason ?? null,
    };
  }
}
