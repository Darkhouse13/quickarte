import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import {
  apiRefreshTokens,
  permissionVersions,
  roles,
  staffMembers,
} from "@quickarte/db-schema";
import { and, eq, isNull } from "drizzle-orm";
import { DatabaseService } from "../database/database.service";
import { ApiJwtService } from "./jwt.strategy";
import { PinHashingService } from "./pin-hashing.service";

const PROBLEM_BASE_URL = "https://api.quickarte.ma/problems";

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
};

const STAFF_ROLE_TO_SYSTEM_ROLE: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  cashier: "Cashier",
  waiter: "Waiter",
  kitchen: "Kitchen",
};

@Injectable()
export class AuthService {
  constructor(
    @Inject(DatabaseService) private readonly databaseService: DatabaseService,
    @Inject(ApiJwtService) private readonly jwtService: ApiJwtService,
    @Inject(PinHashingService) private readonly pinHashingService: PinHashingService,
  ) {}

  async issueStaffPinToken(input: {
    businessId: string;
    pin: string;
  }): Promise<TokenPair> {
    return this.databaseService.withTenant(input.businessId, async (tx) => {
      const staffRows = await tx
        .select({
          id: staffMembers.id,
          userId: staffMembers.userId,
          role: staffMembers.role,
          pinHash: staffMembers.pinHash,
        })
        .from(staffMembers)
        .where(
          and(
            eq(staffMembers.businessId, input.businessId),
            isNull(staffMembers.revokedAt),
          ),
        );

      for (const staff of staffRows) {
        if (!staff.pinHash || !staff.userId) {
          continue;
        }

        const matches = await this.pinHashingService.verify(input.pin, staff.pinHash);
        if (!matches) {
          continue;
        }

        const roleName = STAFF_ROLE_TO_SYSTEM_ROLE[staff.role];
        if (!roleName) {
          continue;
        }

        const [role] = await tx
          .select({ id: roles.id })
          .from(roles)
          .where(and(eq(roles.businessId, input.businessId), eq(roles.name, roleName)))
          .limit(1);

        if (!role) {
          throw new UnauthorizedException({
            type: `${PROBLEM_BASE_URL}/auth-role-missing`,
            message: "Staff role is not initialized for this business.",
          });
        }

        await tx
          .insert(permissionVersions)
          .values({ businessId: input.businessId, version: 1 })
          .onConflictDoNothing();

        const [versionRow] = await tx
          .select({ version: permissionVersions.version })
          .from(permissionVersions)
          .where(eq(permissionVersions.businessId, input.businessId))
          .limit(1);

        const refresh = this.jwtService.createRefreshToken();
        await tx.insert(apiRefreshTokens).values({
          businessId: input.businessId,
          userId: staff.userId,
          tokenHash: refresh.tokenHash,
          expiresAt: refresh.expiresAt,
        });

        return {
          accessToken: this.jwtService.signAccessToken({
            sub: staff.userId,
            business_id: input.businessId,
            role_id: role.id,
            permissions_version: versionRow?.version ?? 1,
            is_platform_admin: false,
          }),
          refreshToken: refresh.token,
          tokenType: "Bearer",
          expiresIn: 15 * 60,
        };
      }

      throw new UnauthorizedException({
        type: `${PROBLEM_BASE_URL}/auth-invalid-credentials`,
        message: "Invalid business or PIN.",
      });
    });
  }
}
