export type MerchantTabId = "home" | "catalog" | "orders" | "loyalty";

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
    { id: "loyalty", label: "Fid\u00e9lit\u00e9", href: "/loyalty" },
  ];
}
