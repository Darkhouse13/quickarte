"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { OrderItemOptions } from "./order-item-options";

export type CartItem = {
  product_id: string;
  product_name: string;
  quantity: number;
  variant_id: string | null;
  variant_name: string | null;
  selected_option_value_ids: string[];
  options_json: OrderItemOptions | null;
  notes: string | null;
  unit_price: number;
  image?: string;
};

type LegacyAddItem = {
  productId: string;
  name: string;
  price: number;
  image?: string;
};

export type ConfiguredAddItem = Omit<CartItem, "quantity"> & {
  quantity?: number;
};

type CartState = {
  items: CartItem[];
  addItem: (product: LegacyAddItem | ConfiguredAddItem) => void;
  removeItem: (lineKey: string) => void;
  decrementProduct: (productId: string) => void;
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
      decrementProduct: (productId) =>
        set((state) => {
          const index = state.items.findIndex((i) => i.product_id === productId);
          if (index === -1) return state;
          return {
            items: state.items.flatMap((item, itemIndex) => {
              if (itemIndex !== index) return [item];
              if (item.quantity <= 1) return [];
              return [{ ...item, quantity: item.quantity - 1 }];
            }),
          };
        }),
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

/**
 * Two configured lines collapse only when variant + selections + notes all
 * match — a tacos with Kefta is a different line from one with Mixte, and a
 * note for the kitchen makes the line distinct too.
 */
export function getCartLineKey(
  item: Pick<
    CartItem,
    "product_id" | "variant_id" | "selected_option_value_ids" | "notes"
  >,
): string {
  const selected = [...item.selected_option_value_ids].sort().join(",");
  return `${item.product_id}|${item.variant_id ?? ""}|${selected}|${item.notes ?? ""}`;
}

function normalizeCartItem(product: LegacyAddItem | ConfiguredAddItem): CartItem {
  if ("product_id" in product) {
    return {
      ...product,
      quantity: product.quantity ?? 1,
      selected_option_value_ids: [...product.selected_option_value_ids].sort(),
      notes:
        product.notes && product.notes.trim().length > 0
          ? product.notes.trim()
          : null,
    };
  }

  return {
    product_id: product.productId,
    product_name: product.name,
    quantity: 1,
    variant_id: null,
    variant_name: null,
    selected_option_value_ids: [],
    options_json: null,
    notes: null,
    unit_price: product.price,
    image: product.image,
  };
}
