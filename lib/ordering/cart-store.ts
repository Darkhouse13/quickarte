"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type CartItem = {
  product_id: string;
  product_name: string;
  quantity: number;
  variant_id: string | null;
  variant_name: string | null;
  selected_option_value_ids: string[];
  selected_options_summary: CartSelectedOption[];
  unit_price: number;
  image?: string;
};

export type CartSelectedOption = {
  option_id: string;
  option_name: string;
  option_type: "single_select" | "multi_select";
  values: Array<{
    value_id: string;
    value_name: string;
    price_addition: number;
  }>;
};

type LegacyAddItem = {
  productId: string;
  name: string;
  price: number;
  image?: string;
};

type ConfiguredAddItem = Omit<CartItem, "quantity"> & { quantity?: number };

type CartState = {
  items: CartItem[];
  addItem: (product: LegacyAddItem | ConfiguredAddItem) => void;
  removeItem: (lineKey: string) => void;
  updateQuantity: (lineKey: string, quantity: number) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;
  getQuantity: (productId: string) => number;
};

const sessionStorageAdapter = () => {
  if (typeof window === "undefined") return undefined;
  return window.sessionStorage;
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (product) =>
        set((state) => {
          const line = normalizeCartItem(product);
          const lineKey = getCartLineKey(line);
          const existing = state.items.find(
            (i) => getCartLineKey(i) === lineKey,
          );
          if (existing) {
            return {
              items: state.items.map((i) =>
                getCartLineKey(i) === lineKey
                  ? { ...i, quantity: i.quantity + line.quantity }
                  : i,
              ),
            };
          }
          return { items: [...state.items, line] };
        }),
      removeItem: (lineKey) =>
        set((state) => ({
          items: state.items.filter((i) => getCartLineKey(i) !== lineKey),
        })),
      updateQuantity: (lineKey, quantity) =>
        set((state) => {
          if (quantity <= 0) {
            return {
              items: state.items.filter((i) => getCartLineKey(i) !== lineKey),
            };
          }
          return {
            items: state.items.map((i) =>
              getCartLineKey(i) === lineKey ? { ...i, quantity } : i,
            ),
          };
        }),
      clearCart: () => set({ items: [] }),
      getTotal: () =>
        get().items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0),
      getItemCount: () =>
        get().items.reduce((sum, i) => sum + i.quantity, 0),
      getQuantity: (productId) =>
        get()
          .items.filter((i) => i.product_id === productId)
          .reduce((sum, i) => sum + i.quantity, 0),
    }),
    {
      name: "quickarte-cart",
      storage: createJSONStorage(() => sessionStorageAdapter() ?? {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
      }),
    },
  ),
);

export function getCartLineKey(item: Pick<
  CartItem,
  "product_id" | "variant_id" | "selected_option_value_ids"
>): string {
  const selected = [...item.selected_option_value_ids].sort().join(",");
  return `${item.product_id}|${item.variant_id ?? ""}|${selected}`;
}

function normalizeCartItem(product: LegacyAddItem | ConfiguredAddItem): CartItem {
  if ("product_id" in product) {
    return {
      ...product,
      quantity: product.quantity ?? 1,
      selected_option_value_ids: [...product.selected_option_value_ids].sort(),
    };
  }

  return {
    product_id: product.productId,
    product_name: product.name,
    quantity: 1,
    variant_id: null,
    variant_name: null,
    selected_option_value_ids: [],
    selected_options_summary: [],
    unit_price: product.price,
    image: product.image,
  };
}
