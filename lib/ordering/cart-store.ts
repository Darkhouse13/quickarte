"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type CartItem = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
};

type CartState = {
  items: CartItem[];
  addItem: (product: Omit<CartItem, "quantity">) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
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
          const existing = state.items.find(
            (i) => i.productId === product.productId,
          );
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.productId === product.productId
                  ? { ...i, quantity: i.quantity + 1 }
                  : i,
              ),
            };
          }
          return { items: [...state.items, { ...product, quantity: 1 }] };
        }),
      removeItem: (productId) =>
        set((state) => ({
          items: state.items.filter((i) => i.productId !== productId),
        })),
      updateQuantity: (productId, quantity) =>
        set((state) => {
          if (quantity <= 0) {
            return {
              items: state.items.filter((i) => i.productId !== productId),
            };
          }
          return {
            items: state.items.map((i) =>
              i.productId === productId ? { ...i, quantity } : i,
            ),
          };
        }),
      clearCart: () => set({ items: [] }),
      getTotal: () =>
        get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
      getItemCount: () =>
        get().items.reduce((sum, i) => sum + i.quantity, 0),
      getQuantity: (productId) =>
        get().items.find((i) => i.productId === productId)?.quantity ?? 0,
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
