import { randomBytes } from "node:crypto";

export function generateWebprintToken(): string {
  return randomBytes(32).toString("base64url");
}

export function formatTestPrintPayload(now = new Date()): string {
  return [
    "=== TEST D'IMPRESSION ===",
    "Quickarte",
    formatFrenchDateTime(now),
    "Si vous lisez ceci, votre",
    "imprimante fonctionne.",
  ].join("\n");
}

export function nextFailureState(attempts: number): {
  attempts: number;
  status: "pending" | "failed";
} {
  const nextAttempts = attempts + 1;
  return {
    attempts: nextAttempts,
    status: nextAttempts >= 3 ? "failed" : "pending",
  };
}

function formatFrenchDateTime(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}
