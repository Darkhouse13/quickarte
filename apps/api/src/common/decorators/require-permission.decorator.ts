import { SetMetadata } from "@nestjs/common";

export const REQUIRED_PERMISSIONS_KEY = "quickarte:required-permissions";
export const REQUIRED_ANY_PERMISSIONS_KEY = "quickarte:required-any-permissions";

export function RequirePermission(...permissions: string[]) {
  return SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
}

export function RequireAnyPermission(...permissions: string[]) {
  return SetMetadata(REQUIRED_ANY_PERMISSIONS_KEY, permissions);
}
