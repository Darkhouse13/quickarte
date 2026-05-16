// Step 7: 3DS challenge flow with card 4000 0025 0000 3155.
// Test-mode 3DS modal auto-completes when you click "Complete authentication".

import { launch, BASE, dump } from "./helpers.mjs";

const CART = [
  { productId: "7e5e744c-56a0-470c-8dda-e627bb3e2c1d", name: "Croissant au beurre", price: 1.6 },
];

const browser = await launch();
const ctx = await browser.createBrowserContext();
const page = await ctx.newPage();
page.setDefaultTimeout(60000);
page.on("framenavigated", (f) => {
  if (f === page.mainFrame()) console.log("[nav]", f.url().slice(0, 140));
});

await page.goto(`${BASE}/fr/cafe-des-arts`, { waitUntil: "domcontentloaded" });
await page.evaluate((items) => {
  sessionStorage.setItem(
    "quickarte-cart",
    JSON.stringify({
      state: { items: items.map((i) => ({ ...i, quantity: 1 })) },
      version: 0,
    }),
  );
}, CART);
await page.goto(`${BASE}/fr/cafe-des-arts/order`, { waitUntil: "domcontentloaded" });
await page.waitForSelector('input[name="customerName"]');
await new Promise((r) => setTimeout(r, 1500));

await page.evaluate(() => {
  function setV(el, v) {
    const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value").set;
    set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true }));
  }
  setV(document.querySelector('input[name="customerName"]'), "3DS Test");
  setV(document.querySelector('input[name="customerPhone"]'), "+212612345678");
  [...document.querySelectorAll('button[type="button"]')]
    .find((b) => /à emporter/i.test(b.textContent || ""))?.click();
});
await page.evaluate(() => {
  [...document.querySelectorAll('button[type="submit"]')]
    .find((b) => /passer commande/i.test(b.textContent || ""))?.click();
});
await page.waitForFunction(
  () => !!document.querySelector('iframe[name^="__privateStripeFrame"]'),
);

async function fillCard() {
  for (let i = 0; i < 30; i++) {
    for (const f of page.frames()) {
      if (!f.url().includes("stripe.com")) continue;
      const el = await f.$('input[name="number"]');
      if (!el) continue;
      await el.focus(); await page.keyboard.type("4000002500003155", { delay: 25 });
      const ex = await f.$('input[name="expiry"]'); await ex.focus(); await page.keyboard.type("1230", { delay: 25 });
      const cv = await f.$('input[name="cvc"]'); await cv.focus(); await page.keyboard.type("123", { delay: 25 });
      const pc = await f.$('input[name="postalCode"]');
      if (pc) { await pc.focus(); await page.keyboard.type("75011", { delay: 25 }); }
      return true;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}
const filled = await fillCard();
dump("card-filled", filled);

// Click Pay.
await page.evaluate(() => {
  [...document.querySelectorAll("button")]
    .find((b) => /payer maintenant/i.test(b.textContent || ""))?.click();
});

// Wait for either the 3DS challenge iframe/modal OR final confirmation.
await page.waitForFunction(
  () => {
    if (location.pathname.includes("/order/confirmation")) return "confirm";
    const frames = [...document.querySelectorAll("iframe")];
    if (frames.some((f) => /3ds|threeDS|challenge/i.test(f.name + " " + f.src))) return "3ds";
    if (/authentication|authenticate|3-d secure/i.test(document.body.innerText)) return "3ds";
    return false;
  },
  { timeout: 60000 },
);

const stage = await page.evaluate(() => ({
  url: location.href,
  frameNames: [...document.querySelectorAll("iframe")].map((f) => f.name || f.id || "").filter(Boolean),
  bodySnippet: document.body.innerText.slice(0, 500),
}));
dump("stage-detected", stage);

// If we're on the 3DS challenge, find the Stripe test "Complete authentication"
// button. Stripe renders it inside a nested iframe whose URL contains
// `3d_secure_2_eap` / `challenge`.
if (!stage.url.includes("/confirmation")) {
  dump("phase", "driving 3DS challenge");
  let completed = false;
  for (let attempt = 0; attempt < 30 && !completed; attempt++) {
    for (const f of page.frames()) {
      if (!/3d[_\s]?secure|challenge|acs|3dsecure/i.test(f.url())) continue;
      try {
        const clicked = await f.evaluate(() => {
          const btns = [...document.querySelectorAll("button, a, input[type='submit']")];
          const b = btns.find((x) =>
            /complete.*authentication|authorize|authoriser|authentifier|complete|succeed/i.test(
              (x.innerText || x.value || x.textContent || "").trim(),
            ),
          );
          if (!b) return null;
          b.click();
          return (b.innerText || b.value || b.textContent || "").slice(0, 60);
        });
        if (clicked) {
          dump("3ds-click", `${clicked} (frame: ${f.url().slice(0, 80)})`);
          completed = true;
          break;
        }
      } catch {}
    }
    if (!completed) await new Promise((r) => setTimeout(r, 500));
  }
  if (!completed) {
    console.error("[fatal] could not find 3DS complete button in any frame");
    for (const f of page.frames()) console.error("  frame:", f.url());
  }
}

try {
  await page.waitForFunction(
    () => location.pathname.includes("/order/confirmation"),
    { timeout: 60000 },
  );
  const body = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 400));
  dump("confirmation-body", body);
  dump("RESULT", "PASS");
} catch (e) {
  dump("timeout-url", page.url());
  dump("timeout-body", await page.evaluate(() => document.body.innerText.slice(0, 500)));
  dump("RESULT", "FAIL");
}

await browser.close();
process.exit(0);
