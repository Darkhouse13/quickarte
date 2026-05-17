import { Body, Controller, Get, HttpException, HttpStatus, Inject, Post, Query, Req } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsISO8601, IsObject, IsOptional } from "class-validator";
import { RateLimitService } from "../auth/rate-limit.service";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import type { AuthenticatedRequest } from "../common/middleware/tenant-context.middleware";
import { SyncService, type SyncPullResponse } from "./sync.service";

class SyncPullQuery {
  @IsOptional()
  @IsISO8601()
  since?: string;
}

class SyncPushBody {
  @IsObject()
  changes!: Record<string, unknown>;

  @IsOptional()
  @IsISO8601()
  lastPulledAt?: string;
}

const PROBLEM_BASE_URL = "https://api.quickarte.ma/problems";

@ApiTags("Sync")
@Controller("sync")
export class SyncController {
  constructor(
    @Inject(SyncService) private readonly syncService: SyncService,
    @Inject(RateLimitService) private readonly rateLimitService: RateLimitService,
  ) {}

  @Get("pull")
  @RequirePermission("business.view")
  @ApiOperation({ summary: "Pull POS terminal sync changes" })
  @ApiQuery({ name: "since", required: false, example: "2026-05-17T10:00:00.000Z" })
  @ApiResponse({
    status: 200,
    description: "WatermelonDB-compatible pull payload.",
    schema: {
      type: "object",
      required: ["changes", "timestamp"],
      properties: {
        changes: {
          type: "object",
          properties: {
            businesses: {
              type: "object",
              required: ["created", "updated", "deleted"],
              properties: {
                created: { type: "array", items: { type: "object", additionalProperties: true } },
                updated: { type: "array", items: { type: "object", additionalProperties: true } },
                deleted: { type: "array", items: { type: "string" } },
              },
            },
            staff_members: {
              type: "object",
              required: ["created", "updated", "deleted"],
              properties: {
                created: { type: "array", items: { type: "object", additionalProperties: true } },
                updated: { type: "array", items: { type: "object", additionalProperties: true } },
                deleted: { type: "array", items: { type: "string" } },
              },
            },
          },
        },
        timestamp: { type: "string", format: "date-time" },
      },
    },
  })
  async pull(
    @Req() request: AuthenticatedRequest,
    @Query() query: SyncPullQuery,
  ): Promise<SyncPullResponse> {
    const businessId = request.businessId!;
    await this.enforceRateLimit("pull", businessId);
    return this.syncService.pull(businessId, query.since);
  }

  @Post("push")
  @RequirePermission("business.view")
  @ApiOperation({ summary: "Push POS terminal sync changes" })
  @ApiBody({
    schema: {
      type: "object",
      required: ["changes"],
      properties: {
        changes: { type: "object", additionalProperties: true },
        lastPulledAt: { type: "string", format: "date-time" },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: "Push accepted.",
    schema: {
      type: "object",
      required: ["status"],
      properties: { status: { type: "string", enum: ["ok"] } },
    },
  })
  async push(
    @Req() request: AuthenticatedRequest,
    @Body() body: SyncPushBody,
  ): Promise<{ status: "ok" }> {
    const businessId = request.businessId!;
    await this.enforceRateLimit("push", businessId);
    await this.syncService.push(businessId, body.changes, body.lastPulledAt);
    return { status: "ok" };
  }

  private async enforceRateLimit(operation: "pull" | "push", businessId: string): Promise<void> {
    const rateLimit = await this.rateLimitService.checkFixedWindow(
      `sync:${operation}`,
      businessId,
      60,
      60,
    );

    if (!rateLimit.allowed) {
      throw new HttpException(
        {
          type: `${PROBLEM_BASE_URL}/rate-limit-exceeded`,
          message: "Too many sync requests. Try again later.",
          retry_after_seconds: rateLimit.retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
