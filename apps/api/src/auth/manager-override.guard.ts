import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import { auditLog, rolePermissions, roles, staffMembers } from "@quickarte/db-schema";
import { and, eq, isNull } from "drizzle-orm";
import type { AuthenticatedRequest } from "../common/middleware/tenant-context.middleware";
import { DatabaseService } from "../database/database.service";
import { PinHashingService } from "./pin-hashing.service";

const PROBLEM_BASE_URL = "https://api.quickarte.ma/problems";
const STAFF_ROLE_TO_SYSTEM_ROLE: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  cashier: "Cashier",
  waiter: "Waiter",
  kitchen: "Kitchen",
};

@Injectable()
export class ManagerOverrideGuard implements CanActivate {
  constructor(
    @Inject(DatabaseService) private readonly databaseService: DatabaseService,
    @Inject(PinHashingService) private readonly pinHashingService: PinHashingService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const managerPinHeader = request.headers["x-manager-pin"];
    const managerPin = Array.isArray(managerPinHeader)
      ? managerPinHeader[0]
      : managerPinHeader;

    if (!request.businessId || !request.userId || !managerPin) {
      throw this.denied();
    }

    const action = `${request.method.toLowerCase()}.${request.route?.path ?? request.path}`;

    const allowed = await this.databaseService.withTenant(
      request.businessId,
      async (tx) => {
        const managers = await tx
          .select({
            id: staffMembers.id,
            userId: staffMembers.userId,
            pinHash: staffMembers.pinHash,
          })
          .from(staffMembers)
          .innerJoin(rolePermissions, eq(rolePermissions.permissionId, "manager.override"))
          .where(
            and(
              eq(staffMembers.businessId, request.businessId!),
              isNull(staffMembers.revokedAt),
            ),
          );

        for (const manager of managers) {
          if (
            manager.pinHash &&
            (await this.pinHashingService.verify(managerPin, manager.pinHash)) &&
            (await this.roleHasOverride(tx, request.businessId!, manager.id))
          ) {
            await tx.insert(auditLog).values({
              businessId: request.businessId!,
              actorUserId: request.userId!,
              action: `manager.override.${action}`,
              beforeState: { overriding_manager_id: manager.id },
            });
            return true;
          }
        }

        await tx.insert(auditLog).values({
          businessId: request.businessId!,
          actorUserId: request.userId!,
          action: "manager.override.failed",
          beforeState: { attempted_action: action },
        });
        return false;
      },
    );

    if (!allowed) {
      throw this.denied();
    }

    return true;
  }

  private denied(): ForbiddenException {
    return new ForbiddenException({
      type: `${PROBLEM_BASE_URL}/manager-override-required`,
      message: "A valid manager override PIN is required.",
    });
  }

  private async roleHasOverride(
    tx: Parameters<Parameters<DatabaseService["withTenant"]>[1]>[0],
    businessId: string,
    staffMemberId: string,
  ): Promise<boolean> {
    const [staff] = await tx
      .select({ role: staffMembers.role })
      .from(staffMembers)
      .where(eq(staffMembers.id, staffMemberId))
      .limit(1);

    if (!staff) {
      return false;
    }

    const roleName = STAFF_ROLE_TO_SYSTEM_ROLE[staff.role];
    if (!roleName) {
      return false;
    }

    const [row] = await tx
      .select({ permissionId: rolePermissions.permissionId })
      .from(roles)
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
      .where(
        and(
          eq(roles.businessId, businessId),
          eq(roles.name, roleName),
          eq(rolePermissions.permissionId, "manager.override"),
        ),
      )
      .limit(1);

    return Boolean(row);
  }
}
