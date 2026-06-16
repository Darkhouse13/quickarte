// Per-entity map of locale → display name, e.g. { fr: "Fromage", ar: "جبن", ary: "فروماج" }
// null when the merchant hasn't entered translations.
export type LocalizedNames = Record<string, string> | null;

// ─── Menu (flat arrays, §2 of handoff) ───────────────────────────────────────

export type MizaneCategory = {
  id: string;
  parentId: string | null;
  name: string;
  localizedNames: LocalizedNames;
  position: number;
};

export type MizaneProduct = {
  id: string;
  categoryId: string;
  name: string;
  localizedNames: LocalizedNames;
  description: string | null;
  // Relative path — prepend https://mizane.xyz to load
  imageUrl: string | null;
  available: boolean;
  position: number;
};

export type MizaneVariant = {
  id: string;
  productId: string;
  name: string;
  localizedNames: LocalizedNames;
  // Full absolute price string e.g. "45.00"
  price: string;
  available: boolean;
  isDefault: boolean;
  position: number;
};

export type MizaneOptionValue = {
  id: string;
  name: string;
  localizedNames: LocalizedNames;
  // Signed decimal string, no explicit "+": "5.00", "-3.00", "0.00"
  priceDelta: string;
  available: boolean;
  allowQuantity: boolean;
  maxQuantity: number;
};

export type MizaneOptionGroup = {
  id: string;
  name: string;
  localizedNames: LocalizedNames;
  type: "single_select" | "multi_select";
  required: boolean;
  minSelect: number;
  maxSelect: number | null;
  values: MizaneOptionValue[];
};

// Junction: which option group applies to which product, in what order
export type MizaneProductOptionGroup = {
  productId: string;
  optionGroupId: string;
  position: number;
};

export type MizaneMenuResponse = {
  currency: string;
  categories: MizaneCategory[];
  products: MizaneProduct[];
  variants: MizaneVariant[];
  optionGroups: MizaneOptionGroup[];
  productOptionGroups: MizaneProductOptionGroup[];
};

// ─── Orders ──────────────────────────────────────────────────────────────────

export type MizaneSelectedOption = {
  optionValueId: string;
  quantity: number;
};

export type MizaneOrderLine = {
  variantId: string;
  quantity: number;
  selectedOptions: MizaneSelectedOption[];
  notes?: string;
};

export type MizaneOrderRequest = {
  idempotencyKey: string;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  // Pass tableId for dine-in, omit for takeaway
  tableId?: string;
  lines: MizaneOrderLine[];
};

export type MizanePlacedOrderLine = {
  variantId: string;
  quantity: number;
  unitPrice: string;
  optionsTotal: string;
  lineTotal: string;
  options: {
    optionValueId: string;
    name: string;
    priceDelta: string;
    quantity: number;
  }[];
};

// "ready" may arrive in future without a version bump — tolerate unknown statuses
export type MizaneOrderStatus =
  | "pending_confirmation"
  | "confirmed"
  | "rejected"
  | (string & {});

export type MizaneOrderResponse = {
  orderId: string;
  orderNumber: string;
  status: MizaneOrderStatus;
  currency: string;
  lines: MizanePlacedOrderLine[];
  // Authoritative total — show this, not our local approximation
  total: string;
};

export type MizaneOrderStatusResponse = {
  orderNumber: string;
  status: MizaneOrderStatus;
  // Present when status === "rejected". "expired" = auto-rejected at 10 min.
  rejectedReason?: string;
  total: string;
};

// ─── Tables (§3) ─────────────────────────────────────────────────────────────

export type MizaneTable = {
  id: string;
  name: string;
  room: string;
};

// ─── Error envelope ──────────────────────────────────────────────────────────

export type MizaneApiError = {
  error: {
    code: string;
    message: string;
    details: Record<string, unknown> | null;
  };
};
