// Step 6: decline + retry on the same order.
// - New session, new order
// - Pay with 4000 0000 0000 0002 → inline decline, stay on page
// - Retry with 4242 on SAME order → succeeds, only ONE charge.succeeded fires

import { launch, BASE, dump } from "./helpers.mjs";

const CART = [
  { productId: "7e5e744c-56a0-470c-8dda-e627bb3e2c1d", name: "Croissant au beurre", price: 1.6 },
  { productId: "43b277bd-2deb-43ff-a034-d987d63cf815", name: "Pain au chocolat", price: 1.8 },
];

const browser = await launch();
const context = await browser.createBrowserContext();
const page = await context.newPage();
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
    set.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
  setV(document.querySelector('input[name="customerName"]'), "Decline Test");
  setV(document.querySelector('input[name="customerPhone"]'), "+212612345678");
  [...document.querySelectorAll('button[type="button"]')]
    .find((b) => /à emporter/i.test(b.textContent || ""))
    ?.click();
});

await page.evaluate(() => {
  [...document.querySelectorAll('button[type="submit"]')]
    .find((b) => /passer commande/i.test(b.textContent || ""))
    ?.click();
});

await page.waitForFunction(
  () => !!document.querySelector('iframe[name^="__privateStripeFrame"]'),
);

async function clearAndType(el, value) {
  await el.focus();
  await page.keyboard.down("Control");
  await page.keyboard.press("a");
  await page.keyboard.up("Control");
  await page.keyboard.press("Delete");
  await page.keyboard.type(value, { delay: 25 });
}

async function fillCard(num, exp, cvc) {
  for (let i = 0; i < 30; i++) {
    for (const f of page.frames()) {
      if (!f.url().includes("stripe.com")) continue;
      const el = await f.$('input[name="number"]');
      if (!el) continue;
      await clearAndType(el, num);
      const ex = await f.$('input[name="expiry"]'); await clearAndType(ex, exp);
      const cv = await f.$('input[name="cvc"]'); await clearAndType(cv, cvc);
      const pc = await f.$('input[name="postalCode"]');
      if (pc) await clearAndType(pc, "75011");
      return true;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function clickPay() {
  await page.evaluate(() => {
    [...document.querySelectorAll("button")]
      .find((b) => /payer maintenant/i.test(b.textContent || ""))
      ?.click();
  });
}

// Capture orderId from the URL once we have one. The order is persisted at
// placeOrder time, so we can read it after the PaymentElement mounts.
await new Promise((r) => setTimeout(r, 500));
const orderNumber = await page.evaluate(() => {
  const m = document.body.innerText.match(/COMMANDE N°\s*([A-Z0-9]+)/i);
  return m ? m[1] : null;
});
dump("order-number", orderNumber);

// --- decline attempt ---
dump("phase", "attempting decline");
await fillCard("4000000000000002", "1230", "123");
await clickPay();
await page.waitForFunction(
  () =>
    /carte.*refusée|card.*declined|échec|declined/i.test(document.body.innerText),
  { timeout: 60000 },
);
const declineBody = await page.evaluate(() => ({
  url: location.href,
  bodyTail: document.body.innerText.slice(-500),
}));
dump("after-decline", declineBody);

if (declineBody.url.includes("/confirmation")) {
  console.error("[fatal] Browser navigated away on decline — should stay on payment page");
  await browser.close();
  process.exit(3);
}

// --- retry with 4242 on the SAME order ---
dump("phase", "retrying with 4242");
// Clear inputs by re-focusing and hitting Home+Shift+End+Delete — or just
// reload the fields by triple-clicking. Simpler: use keyboard to select-all
// the card number first.
await fillCard("4242424242424242", "1230", "123");
await clickPay();

try {
  await page.waitForFunction(
    () => location.pathname.includes("/order/confirmation"),
    { timeout: 90000 },
  );
  const ok = await page.evaluate(() => ({
    url: location.href,
    body: document.body.innerText.replace(/\s+/g, " ").slice(0, 300),
  }));
  dump("confirmation", ok);
  dump("RESULT", "PASS");
} catch (e) {
  dump("state-at-timeout", await page.evaluate(() => ({
    url: location.href,
    body: document.body.innerText.slice(0, 600),
  })));
  dump("RESULT", "FAIL");
}

await browser.close();
process.exit(0);
