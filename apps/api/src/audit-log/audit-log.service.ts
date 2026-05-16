import { Inject, Injectable } from "@nestjs/common";
import { auditLog } from "@quickarte/db-schema";
import { DatabaseService } from "../database/database.service";

type JsonRecord = Record<string, unknown> | unknown[] | string | number | boolean | null;

export type AuditLogInput = {
  businessId: string;
  actorUserId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  beforeState?: JsonRecord;
  afterState?: JsonRecord;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  createdAt?: Date;
};

@Injectable()
export class AuditLogService {
  constructor(
    @Inject(DatabaseService) private readonly databaseService: DatabaseService,
  ) {}

  async recordAction(input: AuditLogInput): Promise<void> {
    await this.databaseService.withTenant(input.businessId, async (tx) => {
      await tx.insert(auditLog).values({
        businessId: input.businessId,
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        beforeState: input.beforeState ?? null,
        afterState: input.afterState ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        requestId: input.requestId ?? null,
        createdAt: input.createdAt,
      });
    });
  }
}
