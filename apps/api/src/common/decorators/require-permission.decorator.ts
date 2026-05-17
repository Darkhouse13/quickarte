import { SetMetadata } from "@nestjs/common";

export const REQUIRED_PERMISSIONS_KEY = "quickarte:required-permissions";

export function RequirePermission(...permissions: string[]) {
  return SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
}
