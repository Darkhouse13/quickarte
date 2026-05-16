// Minimal puppeteer helpers for Stripe E2E. Not intended to be committed long-term.
import puppeteer from "puppeteer-core";

export const CHROME = "/home/darkhouse/.cache/puppeteer/chrome/linux-147.0.7727.57/chrome-linux64/chrome";
export const BASE = "http://localhost:3000";

export async function launch() {
  return puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
}

/**
 * Bypass the client-side React form (which needs hydration before its onSubmit
 * handler is attached — unreliable in Next dev mode). Instead, call Better
 * Auth's sign-in endpoint directly from inside the page, so the Set-Cookie
 * lands in the puppeteer browser jar the same way a real login would.
 */
export async function loginAsCamille(page) {
  page.on("pageerror", (err) => console.error("[pageerror]", err.message));
  // Must be on an origin page first so cookies scope correctly.
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  const res = await page.evaluate(async () => {
    const r = await fetch("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "camille@cafedesarts.fr",
        password: "quickarte123",
      }),
      credentials: "include",
    });
    return { status: r.status, body: await r.text() };
  });
  if (res.status !== 200) {
    throw new Error(`login failed: HTTP ${res.status} ${res.body}`);
  }
}

export async function newCustomerSession() {
  // For checkout flows we just need a fresh incognito context.
  return null;
}

export function dump(label, val) {
  console.log(`[${label}] ${typeof val === "string" ? val : JSON.stringify(val, null, 2)}`);
}
