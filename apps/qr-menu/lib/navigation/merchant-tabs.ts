export type MerchantTabId =
  | "home"
  | "catalog"
  | "orders"
  | "kitchen"
  | "cloture"
  | "loyalty";

export type MerchantTabDefinition = {
  id: MerchantTabId;
  label: string;
  href: string;
  hasNotification?: boolean;
};

export function getMerchantTabs(pendingOrders = 0): MerchantTabDefinition[] {
  return [
    { id: "home", label: "Accueil", href: "/home" },
    { id: "catalog", label: "Catalogue", href: "/catalog" },
    {
      id: "orders",
      label: "Commandes",
      href: "/orders",
      hasNotification: pendingOrders > 0,
    },
    { id: "kitchen", label: "Cuisine", href: "/kitchen" },
    { id: "cloture", label: "Clôture", href: "/cloture" },
    { id: "loyalty", label: "Mes habitu\u00e9s", href: "/loyalty" },
  ];
}
