import type { StaffRole } from "@/lib/identity/permissions";

export const CLOSE_OF_DAY_ROLES = [
  "owner",
  "manager",
  "cashier",
] satisfies StaffRole[];

export function canAccessCloseOfDay(role: StaffRole | null): boolean {
  return (
    role !== null && (CLOSE_OF_DAY_ROLES as readonly StaffRole[]).includes(role)
  );
}

export function isForbiddenRoleError(error: unknown): boolean {
  return error instanceof Error && error.message === "Forbidden";
}
