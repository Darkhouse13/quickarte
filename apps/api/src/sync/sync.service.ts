import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { businesses, staffMembers } from "@quickarte/db-schema";
import { and, eq, isNull } from "drizzle-orm";
import { AuditLogService } from "../audit-log/audit-log.service";
import { DatabaseService } from "../database/database.service";

const PROBLEM_BASE_URL = "https://api.quickarte.ma/problems";
const ALLOWED_PUSH_TABLES = new Set(["audit_log"]);

type SyncTableChanges<T> = {
  created: T[];
  updated: T[];
  deleted: string[];
};

type BusinessSyncRow = {
  id: string;
  name: string;
  slug: string;
  locale: string;
  currency: string;
  timezone: string;
  last_synced_at: number;
};

type StaffMemberSyncRow = {
  id: string;
  business_id: string;
  display_name: string;
  role: string;
  last_synced_at: number;
};

type AuditLogPushRow = {
  business_id?: string;
  actor_user_id?: string | null;
  action?: string;
  entity_type?: string | null;
  entity_id?: string | null;
  before_state?: unknown;
  after_state?: unknown;
  ip_address?: string | null;
  user_agent?: string | null;
  request_id?: string | null;
};

type JsonRecord = Record<string, unknown> | unknown[] | string | number | boolean | null;

export type SyncPullResponse = {
  changes: {
    businesses: SyncTableChanges<BusinessSyncRow>;
    staff_members: SyncTableChanges<StaffMemberSyncRow>;
  };
  timestamp: string;
};

@Injectable()
export class SyncService {
  constructor(
    @Inject(DatabaseService) private readonly databaseService: DatabaseService,
    @Inject(AuditLogService) private readonly auditLogService: AuditLogService,
  ) {}

  async pull(businessId: string, since?: string): Promise<SyncPullResponse> {
    const pulledAt = new Date();
    const sinceDate = since ? new Date(since) : undefined;

    const data = await this.databaseService.withTenant(businessId, async (tx) => {
      const businessRows = await tx
        .select({
          id: businesses.id,
          name: businesses.name,
          slug: businesses.slug,
          locale: businesses.locale,
          currency: businesses.currency,
          timezone: businesses.timezone,
          createdAt: businesses.createdAt,
          updatedAt: businesses.updatedAt,
        })
        .from(businesses)
        .where(eq(businesses.id, businessId));

      const staffRows = await tx
        .select({
          id: staffMembers.id,
          businessId: staffMembers.businessId,
          displayName: staffMembers.displayName,
          role: staffMembers.role,
          createdAt: staffMembers.createdAt,
          updatedAt: staffMembers.updatedAt,
        })
        .from(staffMembers)
        .where(and(eq(staffMembers.businessId, businessId), isNull(staffMembers.revokedAt)));

      return {
        businesses: this.splitRows(
          businessRows,
          sinceDate,
          (row) => ({
            id: row.id,
            name: row.name,
            slug: row.slug,
            locale: row.locale,
            currency: row.currency,
            timezone: row.timezone,
            last_synced_at: pulledAt.getTime(),
          }),
        ),
        staff_members: this.splitRows(
          staffRows,
          sinceDate,
          (row) => ({
            id: row.id,
            business_id: row.businessId,
            display_name: row.displayName,
            role: row.role,
            last_synced_at: pulledAt.getTime(),
          }),
        ),
      };
    });

    return {
      changes: {
        businesses: data.businesses,
        staff_members: data.staff_members,
      },
      timestamp: pulledAt.toISOString(),
    };
  }

  async push(
    businessId: string,
    changes: Record<string, unknown>,
    _lastPulledAt?: string,
  ): Promise<void> {
    for (const tableName of Object.keys(changes)) {
      if (!ALLOWED_PUSH_TABLES.has(tableName)) {
        throw new BadRequestException({
          type: `${PROBLEM_BASE_URL}/sync-table-not-allowed`,
          message: `Sync push does not accept table '${tableName}'.`,
        });
      }
    }

    const auditChanges = this.readTableChanges<AuditLogPushRow>(
      changes.audit_log,
    );
    if (auditChanges.updated.length > 0 || auditChanges.deleted.length > 0) {
      throw new BadRequestException({
        type: `${PROBLEM_BASE_URL}/sync-operation-not-allowed`,
        message: "Only audit_log created rows are accepted in M6.",
      });
    }

    for (const row of auditChanges.created) {
      if (row.business_id !== businessId || !row.action) {
        throw new BadRequestException({
          type: `${PROBLEM_BASE_URL}/sync-invalid-row`,
          message: "audit_log rows must match the authenticated business and include action.",
        });
      }

      await this.auditLogService.recordAction({
        businessId,
        actorUserId: row.actor_user_id ?? null,
        action: row.action,
        entityType: row.entity_type ?? null,
        entityId: row.entity_id ?? null,
        beforeState: this.toJsonRecord(row.before_state),
        afterState: this.toJsonRecord(row.after_state),
        ipAddress: row.ip_address ?? null,
        userAgent: row.user_agent ?? null,
        requestId: row.request_id ?? null,
      });
    }
  }

  private splitRows<TRow extends { createdAt: Date; updatedAt: Date }, TOutput>(
    rows: TRow[],
    sinceDate: Date | undefined,
    map: (row: TRow) => TOutput,
  ): SyncTableChanges<TOutput> {
    if (!sinceDate) {
      return {
        created: rows.map(map),
        updated: [],
        deleted: [],
      };
    }

    return {
      created: rows.filter((row) => row.createdAt > sinceDate).map(map),
      updated: rows
        .filter((row) => row.updatedAt > sinceDate && row.createdAt <= sinceDate)
        .map(map),
      deleted: [],
    };
  }

  private readTableChanges<T>(value: unknown): SyncTableChanges<T> {
    if (!value || typeof value !== "object") {
      return { created: [], updated: [], deleted: [] };
    }

    const table = value as Partial<SyncTableChanges<T>>;
    return {
      created: Array.isArray(table.created) ? table.created : [],
      updated: Array.isArray(table.updated) ? table.updated : [],
      deleted: Array.isArray(table.deleted) ? table.deleted : [],
    };
  }

  private toJsonRecord(value: unknown): JsonRecord | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (
      value === null ||
      Array.isArray(value) ||
      ["string", "number", "boolean"].includes(typeof value)
    ) {
      return value as JsonRecord;
    }
    if (typeof value === "object") {
      return value as Record<string, unknown>;
    }
    return undefined;
  }
}
