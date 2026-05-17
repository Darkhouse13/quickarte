import { Controller, Get, HttpException, HttpStatus, Inject, Query, Req } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { auditLog } from "@quickarte/db-schema";
import { and, desc, eq, lt } from "drizzle-orm";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import type { AuthenticatedRequest } from "../common/middleware/tenant-context.middleware";
import { RateLimitService } from "../auth/rate-limit.service";
import { DatabaseService } from "../database/database.service";

type AuditLogResponse = {
  items: Array<{
    id: string;
    businessId: string;
    actorUserId: string | null;
    action: string;
    entityType: string | null;
    entityId: string | null;
    beforeState: unknown;
    afterState: unknown;
    ipAddress: string | null;
    userAgent: string | null;
    requestId: string | null;
    createdAt: string;
  }>;
};

const PROBLEM_BASE_URL = "https://api.quickarte.ma/problems";

@ApiTags("Audit Log")
@Controller("audit-log")
export class AuditLogController {
  constructor(
    @Inject(DatabaseService) private readonly databaseService: DatabaseService,
    @Inject(RateLimitService) private readonly rateLimitService: RateLimitService,
  ) {}

  @Get()
  @RequirePermission("audit_log.view")
  @ApiOperation({ summary: "List audit-log entries for the current tenant" })
  @ApiQuery({ name: "limit", required: false, example: 50 })
  @ApiQuery({ name: "before", required: false, example: "2026-05-16T12:00:00.000Z" })
  @ApiResponse({ status: 200, description: "Tenant-scoped audit-log entries." })
  async list(
    @Req() request: AuthenticatedRequest,
    @Query("limit") limitQuery?: string,
    @Query("before") beforeQuery?: string,
  ): Promise<AuditLogResponse> {
    const businessId = request.businessId!;
    await this.enforceRateLimit(businessId);
    const limit = Math.min(Math.max(Number(limitQuery ?? 50) || 50, 1), 100);
    const before = beforeQuery ? new Date(beforeQuery) : undefined;

    const rows = await this.databaseService.withTenant(businessId, (tx) =>
      tx
        .select()
        .from(auditLog)
        .where(
          before && !Number.isNaN(before.getTime())
            ? and(eq(auditLog.businessId, businessId), lt(auditLog.createdAt, before))
            : eq(auditLog.businessId, businessId),
        )
        .orderBy(desc(auditLog.createdAt))
        .limit(limit),
    );

    return {
      items: rows.map((row) => ({
        id: row.id,
        businessId: row.businessId,
        actorUserId: row.actorUserId,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        beforeState: row.beforeState,
        afterState: row.afterState,
        ipAddress: row.ipAddress,
        userAgent: row.userAgent,
        requestId: row.requestId,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  private async enforceRateLimit(businessId: string): Promise<void> {
    const rateLimit = await this.rateLimitService.checkFixedWindow(
      "audit-log:list",
      businessId,
      30,
      60,
    );

    if (!rateLimit.allowed) {
      throw new HttpException(
        {
          type: `${PROBLEM_BASE_URL}/rate-limit-exceeded`,
          message: "Too many audit-log requests. Try again later.",
          retry_after_seconds: rateLimit.retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
