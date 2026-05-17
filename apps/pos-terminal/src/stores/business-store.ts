import { create } from "zustand";

type BusinessState = {
  businessName: string | null;
  staffDisplayName: string | null;
  setBusinessName: (businessName: string | null) => void;
  setStaffDisplayName: (staffDisplayName: string | null) => void;
};

export const useBusinessStore = create<BusinessState>((set) => ({
  businessName: null,
  staffDisplayName: null,
  setBusinessName: (businessName) => set({ businessName }),
  setStaffDisplayName: (staffDisplayName) => set({ staffDisplayName }),
}));
