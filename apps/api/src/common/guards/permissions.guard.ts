import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  permissionVersions,
  rolePermissions,
} from "@quickarte/db-schema";
import { and, eq, inArray } from "drizzle-orm";
import type { AuthenticatedRequest } from "../middleware/tenant-context.middleware";
import { DatabaseService } from "../../database/database.service";
import {
  REQUIRED_ANY_PERMISSIONS_KEY,
  REQUIRED_PERMISSIONS_KEY,
} from "../decorators/require-permission.decorator";

const PROBLEM_BASE_URL = "https://api.quickarte.ma/problems";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(DatabaseService) private readonly databaseService: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    const requiredAny = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_ANY_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if ((!required || required.length === 0) && (!requiredAny || requiredAny.length === 0)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.businessId || !request.userId || !request.roleId) {
      throw new UnauthorizedException({
        type: `${PROBLEM_BASE_URL}/auth-required`,
        message: "Authentication is required.",
      });
    }

    const result = await this.databaseService.withTenant(
      request.businessId,
      async (tx) => {
        const [versionRow] = await tx
          .select({ version: permissionVersions.version })
          .from(permissionVersions)
          .where(eq(permissionVersions.businessId, request.businessId!))
          .limit(1);

        if (
          versionRow &&
          versionRow.version !== request.permissionsVersion
        ) {
          return { stale: true, permissions: [] as string[] };
        }

        const rows = await tx
          .select({ permissionId: rolePermissions.permissionId })
          .from(rolePermissions)
          .where(
            and(
              eq(rolePermissions.roleId, request.roleId!),
                inArray(rolePermissions.permissionId, [
                  ...(required ?? []),
                  ...(requiredAny ?? []),
                ]),
            ),
          );

        return {
          stale: false,
          permissions: rows.map((row) => row.permissionId),
        };
      },
    );

    if (result.stale) {
      throw new UnauthorizedException({
        type: `${PROBLEM_BASE_URL}/permissions-stale`,
        message: "Permission version is stale. Re-authentication is required.",
      });
    }

    const hasAll = (required ?? []).every((permission) =>
      result.permissions.includes(permission),
    );
    const hasAny =
      !requiredAny ||
      requiredAny.length === 0 ||
      requiredAny.some((permission) => result.permissions.includes(permission));

    if (!hasAll || !hasAny) {
      throw new ForbiddenException({
        type: `${PROBLEM_BASE_URL}/permission-denied`,
        message: "You do not have permission to perform this action.",
      });
    }

    return true;
  }
}
