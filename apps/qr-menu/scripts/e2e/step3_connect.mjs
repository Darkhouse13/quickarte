import { launch, loginAsCamille, BASE, dump } from "./helpers.mjs";

const browser = await launch();
const page = await browser.newPage();
page.setDefaultTimeout(30000);

page.on("framenavigated", (f) => {
  if (f === page.mainFrame()) console.log("[nav]", f.url());
});
page.on("requestfailed", (req) =>
  console.log("[reqfailed]", req.method(), req.url().slice(0, 100), req.failure()?.errorText),
);
page.on("request", (req) => {
  if (req.isNavigationRequest()) {
    console.log("[navreq]", req.method(), req.url().slice(0, 100));
  }
});

await loginAsCamille(page);
await page.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded" });
await new Promise((r) => setTimeout(r, 2000));

// Submit the form containing the Connecter Stripe button directly, bypassing
// React. Next.js server actions work as standard HTML form POSTs with the
// hidden $ACTION_ID input.
const submitted = await page.evaluate(() => {
  const btns = [...document.querySelectorAll("button")];
  const b = btns.find((x) => x.textContent?.includes("Connecter Stripe"));
  if (!b) return { ok: false, reason: "button-missing" };
  const f = b.closest("form");
  if (!f) return { ok: false, reason: "form-missing" };
  const hidden = [...f.querySelectorAll('input[type="hidden"]')].map((i) => i.name);
  f.submit();
  return { ok: true, action: f.action, method: f.method, hidden };
});
dump("submitted", submitted);

await new Promise((r) => setTimeout(r, 6000));
dump("final-url", page.url());

await browser.close();
process.exit(0);
