import { Body, Controller, Get, Inject, Post, Query, Req } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsISO8601, IsObject, IsOptional } from "class-validator";
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

@ApiTags("Sync")
@Controller("sync")
export class SyncController {
  constructor(@Inject(SyncService) private readonly syncService: SyncService) {}

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
    return this.syncService.pull(request.businessId!, query.since);
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
    await this.syncService.push(request.businessId!, body.changes, body.lastPulledAt);
    return { status: "ok" };
  }
}
