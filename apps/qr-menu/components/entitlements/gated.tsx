import type { ReactNode } from "react";
import { hasEntitlement } from "@/lib/entitlements/queries";
import type { ModuleKey } from "@/lib/entitlements/types";

type GatedProps = {
  module: ModuleKey;
  businessId: string;
  fallback?: ReactNode;
  children: ReactNode;
};

export async function Gated({
  module,
  businessId,
  fallback = null,
  children,
}: GatedProps) {
  const entitled = await hasEntitlement(businessId, module);
  if (!entitled) return <>{fallback}</>;
  return <>{children}</>;
}
