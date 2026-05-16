import { BadRequestException, Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      businessId?: string;
    }
  }
}

export type TenantRequest = Request & { businessId?: string };

const PROBLEM_BASE_URL = "https://api.quickarte.ma/problems";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(request: TenantRequest, _response: Response, next: NextFunction): void {
    if (this.isPublicPath(request)) {
      next();
      return;
    }

    const tenantHeader = request.headers["x-tenant-id"];
    const businessId = Array.isArray(tenantHeader) ? tenantHeader[0] : tenantHeader;

    if (!businessId) {
      next(
        new BadRequestException({
          type: `${PROBLEM_BASE_URL}/tenant-context-required`,
          message: "Tenant context is required. Send X-Tenant-Id for tenanted API routes.",
        }),
      );
      return;
    }

    if (!UUID_PATTERN.test(businessId)) {
      next(
        new BadRequestException({
          type: `${PROBLEM_BASE_URL}/tenant-context-invalid`,
          message: "Tenant context is invalid. X-Tenant-Id must be a UUID.",
        }),
      );
      return;
    }

    request.businessId = businessId;
    next();
  }

  private isPublicPath(request: Request): boolean {
    const path = (request.originalUrl ?? request.url ?? "").split("?")[0] ?? "";
    return (
      path === "/health" ||
      path === "/v1/health" ||
      path === "/docs" ||
      path === "/v1/docs" ||
      path === "/docs-json" ||
      path === "/v1/docs-json" ||
      path.startsWith("/docs/") ||
      path.startsWith("/v1/docs/")
    );
  }
}
