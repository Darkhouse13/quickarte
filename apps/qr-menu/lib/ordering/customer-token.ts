import { randomBytes } from "node:crypto";

export function generateCustomerAccessToken(): string {
  return randomBytes(24).toString("base64url");
}
