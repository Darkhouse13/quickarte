"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// Parallel to lib/ordering/cart-store.ts: same persistence shape, different
// mechanics. The MAD cart bills currency; this one bills credits. We keep
// them in separate stores so a customer can browse both surfaces without one
// cart silently mutating the other.

export type CreditCartItem = {
  listingId: string;
  productId: string;
  productName: string;
  creditPrice: number;
  quantity: number;
  image?: string;
};

type CreditCartState = {
  businessSlug: string | null;
  phoneNormalized: string | null;
  items: CreditCartItem[];
  updatedAt: number | null;
  setIdentity: (input: {
    businessSlug: string;
    phoneNormalized: string | null;
  }) => void;
  addItem: (item: Omit<CreditCartItem, "quantity">) => void;
  removeItem: (listingId: string) => void;
  decrementListing: (listingId: string) => void;
  updateQuantity: (listingId: string, quantity: number) => void;
  clearCart: () => void;
  getTotalCredits: () => number;
  getItemCount: () => number;
  getQuantity: (listingId: string) => number;
};

const persistStorageAdapter = () => {
  if (typeof window === "undefined") return undefined;
  return window.localStorage;
};

export const useCreditCartStore = create<CreditCartState>()(
  persist(
    (set, get) => ({
      businessSlug: null,
      phoneNormalized: null,
      items: [],
      updatedAt: null,
      setIdentity: ({ businessSlug, phoneNormalized }) => {
        const slugChanged =
          get().businessSlug !== null && get().businessSlug !== businessSlug;
        set({
          businessSlug,
          phoneNormalized,
          // Switching slug invalidates any items in the cart — those belong
          // to a different merchant's program and cannot move with us.
          items: slugChanged ? [] : get().items,
          updatedAt: Date.now(),
        });
        // Re-key the persist layer so the cart lives at
        // `quickarte:credit-cart:{slug}` and never bleeds across merchants
        // sharing the same browser.
        if (typeof window !== "undefined") {
          try {
            useCreditCartStore.persist.setOptions({
              name: `quickarte:credit-cart:${businessSlug}`,
            });
            void useCreditCartStore.persist.rehydrate();
          } catch {
            // setOptions/rehydrate are exposed by zustand's persist middleware
            // and should always exist; swallow the unlikely throw.
          }
        }
      },
      addItem: (item) =>
        set((state) => {
          const existing = state.items.find(
            (line) => line.listingId === item.listingId,
          );
          if (existing) {
            return {
              items: state.items.map((line) =>
                line.listingId === item.listingId
                  ? { ...line, quantity: line.quantity + 1 }
                  : line,
              ),
              updatedAt: Date.now(),
            };
          }
          return {
            items: [...state.items, { ...item, quantity: 1 }],
            updatedAt: Date.now(),
          };
        }),
      removeItem: (listingId) =>
        set((state) => ({
          items: state.items.filter((i) => i.listingId !== listingId),
          updatedAt: Date.now(),
        })),
      decrementListing: (listingId) =>
        set((state) => ({
          items: state.items.flatMap((line) => {
            if (line.listingId !== listingId) return [line];
            if (line.quantity <= 1) return [];
            return [{ ...line, quantity: line.quantity - 1 }];
          }),
          updatedAt: Date.now(),
        })),
      updateQuantity: (listingId, quantity) =>
        set((state) => {
          if (quantity <= 0) {
            return {
              items: state.items.filter((i) => i.listingId !== listingId),
              updatedAt: Date.now(),
            };
          }
          return {
            items: state.items.map((line) =>
              line.listingId === listingId ? { ...line, quantity } : line,
            ),
            updatedAt: Date.now(),
          };
        }),
      clearCart: () =>
        set({ items: [], updatedAt: Date.now() }),
      getTotalCredits: () =>
        creditCartTotal(get().items),
      getItemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
      getQuantity: (listingId) =>
        get()
          .items.filter((i) => i.listingId === listingId)
          .reduce((sum, i) => sum + i.quantity, 0),
    }),
    {
      // The per-business suffix is rewritten when the user switches stores.
      // The base name without a suffix is the per-tab fallback if we ever
      // forget to set identity — the per-business key below is the source
      // of truth in practice.
      name: "quickarte:credit-cart",
      storage: createJSONStorage(() => persistStorageAdapter() ?? {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
      }),
    },
  ),
);

export function creditCartTotal(items: CreditCartItem[]): number {
  return items.reduce((sum, item) => sum + item.creditPrice * item.quantity, 0);
}

export function creditCartItemCount(items: CreditCartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

// True when adding one of `listing` to `cart` keeps the running total
// below the customer's current balance. Used both by the per-card
// disabled state and by checkout-side guards.
export function canAddListing(input: {
  listing: { creditPrice: number };
  cart: CreditCartItem[];
  balance: number;
}): boolean {
  const next = creditCartTotal(input.cart) + input.listing.creditPrice;
  return next <= input.balance;
}

const PHONE_STORAGE_KEY = "quickarte:customer:phone";

// URL param wins over localStorage because a customer who clicks a deep link
// from the tracker is telling us which phone to use; we still mirror it into
// storage on submit so refreshes don't reset state.
export function resolveCustomerPhone(input: {
  fromUrl: string | null | undefined;
  fromStorage: string | null | undefined;
}): string | null {
  const trim = (v: string | null | undefined) => (v?.trim() ? v.trim() : null);
  return trim(input.fromUrl) ?? trim(input.fromStorage);
}

export function readPhoneFromLocalStorage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(PHONE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writePhoneToLocalStorage(phone: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PHONE_STORAGE_KEY, phone);
  } catch {
    // localStorage can throw in Safari private mode or when quota is full —
    // the surface still works in-memory for the duration of the session.
  }
}
