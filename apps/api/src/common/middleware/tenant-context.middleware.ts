import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
  type NestMiddleware,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { NextFunction, Request, Response } from "express";
import { ApiJwtService } from "../../auth/jwt.strategy";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      businessId?: string;
      userId?: string;
      roleId?: string;
      permissionsVersion?: number;
      isPlatformAdmin?: boolean;
    }
  }
}

export type TenantRequest = Request & { businessId?: string };
export type AuthenticatedRequest = Request & {
  businessId?: string;
  userId?: string;
  roleId?: string;
  permissionsVersion?: number;
  isPlatformAdmin?: boolean;
};

const PROBLEM_BASE_URL = "https://api.quickarte.ma/problems";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(
    @Inject(ApiJwtService) private readonly jwtService: ApiJwtService,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  use(request: TenantRequest, _response: Response, next: NextFunction): void {
    if (this.isPublicPath(request)) {
      next();
      return;
    }

    const authHeader = request.headers.authorization;
    const bearerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : undefined;

    if (bearerToken) {
      try {
        const claims = this.jwtService.verifyAccessToken(bearerToken);
        request.businessId = claims.business_id;
        request.userId = claims.sub;
        request.roleId = claims.role_id;
        request.permissionsVersion = claims.permissions_version;
        request.isPlatformAdmin = claims.is_platform_admin;
        next();
        return;
      } catch (error) {
        next(error);
        return;
      }
    }

    const tenantHeader = request.headers["x-tenant-id"];
    const businessId = Array.isArray(tenantHeader) ? tenantHeader[0] : tenantHeader;

    if (businessId && this.configService.get<string>("NODE_ENV") === "production") {
      next(
        new UnauthorizedException({
          type: `${PROBLEM_BASE_URL}/auth-required`,
          message: "Authorization bearer token is required in production.",
        }),
      );
      return;
    }

    if (!businessId) {
      next(
        new UnauthorizedException({
          type: `${PROBLEM_BASE_URL}/auth-required`,
          message: "Authorization bearer token is required.",
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
      path === "/auth/staff/pin-login" ||
      path === "/v1/auth/staff/pin-login" ||
      path === "/auth/owner/login" ||
      path === "/v1/auth/owner/login" ||
      path === "/auth/refresh" ||
      path === "/v1/auth/refresh" ||
      path === "/docs" ||
      path === "/v1/docs" ||
      path === "/docs-json" ||
      path === "/v1/docs-json" ||
      path.startsWith("/docs/") ||
      path.startsWith("/v1/docs/")
    );
  }
}
