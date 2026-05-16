import createOpenApiFetch, { type ClientOptions } from "openapi-fetch";
import type { paths } from "./api";

export type { paths } from "./api";

export function createClient(
  baseUrl: string,
  options: Omit<ClientOptions, "baseUrl"> = {},
) {
  return createOpenApiFetch<paths>({
    baseUrl,
    ...options,
  });
}
