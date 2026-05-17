import { create } from "zustand";
import { resolveTenantFromLocation } from "./resolve";

type TenantState = {
  slug: string | null;
  tenantRequired: boolean;
  hydrate: () => void;
};

export const useTenantStore = create<TenantState>((set) => ({
  slug: null,
  tenantRequired: false,
  hydrate: () => set(resolveTenantFromLocation(window.location)),
}));
