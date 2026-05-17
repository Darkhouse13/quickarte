import { createClient } from "@quickarte/shared-types";
import { useAuthStore } from "../stores/auth-store";

const defaultBaseUrl = "http://localhost:3001/v1";

export function apiClient() {
  const token = useAuthStore.getState().accessToken;
  return createClient(process.env.EXPO_PUBLIC_API_BASE_URL ?? defaultBaseUrl, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}
