// Step 4: happy-path customer payment with test card 4242.
// - Fresh incognito context (customer, not merchant)
// - Pre-populate cart in sessionStorage, skip the menu UI
// - Navigate to /order, fill contact, submit
// - Drive Stripe's Payment Element to pay with 4242 / 12/30 / 123
// - Expect redirect to /order/confirmation?orderId=...&pi=...

import { launch, BASE, dump } from "./helpers.mjs";

const CART = [
  { productId: "7e5e744c-56a0-470c-8dda-e627bb3e2c1d", name: "Croissant au beurre", price: 1.6 },
  { productId: "43b277bd-2deb-43ff-a034-d987d63cf815", name: "Pain au chocolat", price: 1.8 },
  { productId: "4375d3e8-9d55-4d55-8c3f-70e7f0c5baad", name: "Café", price: 1.8 },
];
const CARD = process.argv[2] ?? "4242424242424242";
const LABEL = process.argv[3] ?? "happy";

const browser = await launch();
const context = await browser.createBrowserContext(); // fresh cookie jar
const page = await context.newPage();
page.setDefaultTimeout(60000);

page.on("framenavigated", (f) => {
  if (f === page.mainFrame()) console.log("[nav]", f.url().slice(0, 140));
});
page.on("pageerror", (err) => console.error("[pageerror]", err.message));

// Seed the cart into sessionStorage before landing on /order. We still hit
// the storefront root first so the origin is correct; then we write the cart
// and navigate.
await page.goto(`${BASE}/fr/cafe-des-arts`, { waitUntil: "domcontentloaded" });
await page.evaluate((items) => {
  const cart = {
    state: { items: items.map((i) => ({ ...i, quantity: 1 })) },
    version: 0,
  };
  sessionStorage.setItem("quickarte-cart", JSON.stringify(cart));
}, CART);
dump("cart-seeded", CART.map((c) => c.name));

await page.goto(`${BASE}/fr/cafe-des-arts/order`, { waitUntil: "domcontentloaded" });
await page.waitForSelector('input[name="customerName"]', { timeout: 30000 });
await new Promise((r) => setTimeout(r, 1500)); // let hydration settle

// Fill contact + switch to takeaway so we don't hit the dine_in tableNumber
// requirement. Phone uses Moroccan format — the schema regex rejects French
// numbers (bug #2 in final report).
await page.evaluate(() => {
  function setReactInput(el, value) {
    const proto = Object.getPrototypeOf(el);
    const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
  setReactInput(document.querySelector('input[name="customerName"]'), "Test Customer");
  setReactInput(document.querySelector('input[name="customerPhone"]'), "+212612345678");

  // Switch orderType → takeaway via the aria-pressed toggle.
  const btns = [...document.querySelectorAll('button[type="button"]')];
  const ta = btns.find((b) => /à emporter/i.test(b.textContent || ""));
  ta?.click();
});
dump("contact-filled", "ok");

// Verify the cart got rehydrated (otherwise the useEffect in CheckoutForm
// would have bounced us back to the menu).
const before = await page.evaluate(() => ({
  url: location.href,
  itemCount: document.querySelectorAll("li").length,
  name: document.querySelector('input[name="customerName"]')?.value,
  phone: document.querySelector('input[name="customerPhone"]')?.value,
  bodyStart: document.body.innerText.slice(0, 300),
}));
dump("pre-submit", before);

// Click the submit button directly — requestSubmit() doesn't reliably
// invoke the React onSubmit handler in Next dev mode.
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button[type="submit"]')];
  const b = btns.find((x) => /passer commande/i.test(x.textContent || ""));
  b?.click();
});
dump("submit-clicked", "ok");

// Wait for the Payment Element iframe to show up OR for an error banner.
await page.waitForFunction(
  () => {
    if (document.querySelector('iframe[name^="__privateStripeFrame"]')) return "iframe";
    if (/échec|erreur|indisponible/i.test(document.body.innerText)) return "error";
    return false;
  },
  { timeout: 60000 },
).catch(() => null);

const postSubmit = await page.evaluate(() => ({
  url: location.href,
  hasIframe: !!document.querySelector('iframe[name^="__privateStripeFrame"]'),
  bodyStart: document.body.innerText.slice(0, 400),
}));
dump("post-submit", postSubmit);

if (!postSubmit.hasIframe) {
  console.error("[fatal] Payment Element never mounted");
  await browser.close();
  process.exit(3);
}
dump("payment-element-mounted", "ok");

// Fill the Stripe Payment Element. Stripe's iframes reject synthetic events,
// so we must focus the field and drive real keyboard events (CDP keyboard
// sends isTrusted=true events).
async function fillCardInFrames() {
  for (let attempt = 0; attempt < 30; attempt++) {
    for (const frame of page.frames()) {
      if (!frame.url().includes("stripe.com")) continue;
      const number = await frame.$('input[name="number"]');
      if (!number) continue;
      await number.focus();
      await page.keyboard.type(CARD, { delay: 25 });
      const expiry = await frame.$('input[name="expiry"]');
      await expiry.focus();
      await page.keyboard.type("1230", { delay: 25 });
      const cvc = await frame.$('input[name="cvc"]');
      await cvc.focus();
      await page.keyboard.type("123", { delay: 25 });
      const pc = await frame.$('input[name="postalCode"]');
      if (pc) {
        await pc.focus();
        await page.keyboard.type("75011", { delay: 25 });
      }
      return true;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

const filled = await fillCardInFrames();
dump("card-filled", filled);
if (!filled) {
  console.error("[fatal] could not find card input inside any Stripe iframe");
  for (const f of page.frames()) console.error("  frame:", f.url());
  await browser.close();
  process.exit(2);
}

// Click "Payer maintenant". Stripe confirms, either redirects to return_url
// (3DS / redirect-based methods) or the React handler router.replace()s us
// to /confirmation?pi=...
await page.evaluate(() => {
  const btns = [...document.querySelectorAll("button")];
  const b = btns.find((x) => /payer maintenant/i.test(x.textContent || ""));
  b?.click();
});
dump("submitted-payment", "ok");

// Wait for /confirmation URL (either via router.replace or return_url nav).
try {
  await page.waitForFunction(
    () => location.pathname.includes("/order/confirmation"),
    { timeout: 90000 },
  );
  const confirmState = await page.evaluate(() => ({
    url: location.href,
    body: document.body.innerText.replace(/\s+/g, " ").slice(0, 400),
  }));
  dump("confirmation", confirmState);
  dump("RESULT", "PASS");
} catch (e) {
  const snap = await page.evaluate(() => ({
    url: location.href,
    body: document.body.innerText.replace(/\s+/g, " ").slice(0, 600),
  }));
  dump("timeout-state", snap);
  dump("RESULT", "FAIL");
}

await browser.close();
process.exit(0);
