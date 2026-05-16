import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { DatabaseService } from "../database/database.service";

export type HealthResponse = {
  status: "ok";
  db: "ok" | "error";
  timestamp: string;
};

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly databaseService: DatabaseService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Check API and database health" })
  @ApiResponse({
    status: 200,
    description: "API is healthy and database is reachable.",
    schema: {
      example: {
        status: "ok",
        db: "ok",
        timestamp: "2026-05-16T12:00:00.000Z",
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: "API is running but database is not reachable.",
  })
  async getHealth(): Promise<HealthResponse> {
    const timestamp = new Date().toISOString();
    const db = await this.databaseService.checkHealth();

    if (db === "error") {
      throw new ServiceUnavailableException({
        message: "Database health check failed",
        db,
        timestamp,
      });
    }

    return {
      status: "ok",
      db,
      timestamp,
    };
  }
}
