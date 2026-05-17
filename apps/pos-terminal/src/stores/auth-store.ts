import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";
import { create } from "zustand";
import { apiClient } from "../api/client";

const ACCESS_TOKEN_KEY = "quickarte_pos_access_token";
const REFRESH_TOKEN_KEY = "quickarte_pos_refresh_token";

type LoginInput = {
  businessId: string;
  pin: string;
};

type LoginResult =
  | { ok: true }
  | { ok: false; retryAfterSeconds?: number };

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  hydrated: boolean;
  loading: boolean;
  hydrate: () => Promise<void>;
  login: (input: LoginInput) => Promise<LoginResult>;
  signOut: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  hydrated: false,
  loading: false,
  async hydrate() {
    const [accessToken, refreshToken] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
    ]);
    set({ accessToken, refreshToken, hydrated: true });
  },
  async login(input) {
    set({ loading: true });
    const client = apiClient();
    const response = await client.POST("/v1/auth/staff/pin-login", {
      body: input,
    });
    set({ loading: false });

    if (response.error || !response.data) {
      const error = response.error as { retry_after_seconds?: number } | undefined;
      return { ok: false, retryAfterSeconds: error?.retry_after_seconds };
    }

    const { accessToken, refreshToken } = response.data;
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken),
      SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken),
    ]);
    set({ accessToken, refreshToken, hydrated: true });
    router.replace("/home");
    return { ok: true };
  },
  async signOut() {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    ]);
    set({ accessToken: null, refreshToken: null, hydrated: true });
    router.replace("/login");
  },
}));
