export const MODULE_KEYS = [
  "menu_qr",
  "online_ordering",
  "loyalty",
  "analytics",
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

export const ENTITLEMENT_SOURCES = [
  "trial",
  "paid",
  "manual",
  "grandfathered",
] as const;

export type EntitlementSource = (typeof ENTITLEMENT_SOURCES)[number];

export type Entitlement = {
  businessId: string;
  module: ModuleKey;
  enabled: boolean;
  planTier: string | null;
  validUntil: Date | null;
  source: EntitlementSource;
  createdAt: Date;
  updatedAt: Date;
};

export function isModuleKey(value: string): value is ModuleKey {
  return (MODULE_KEYS as readonly string[]).includes(value);
}
