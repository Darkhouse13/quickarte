// Drive Stripe's hosted Express onboarding form in test mode. Test mode
// exposes a "Skip this account form" / "Use test data" flow — we click
// through it until charges_enabled flips.
import { launch, dump } from "./helpers.mjs";

const url = process.argv[2];
if (!url) {
  console.error("usage: drive_onboarding.mjs <onboarding-url>");
  process.exit(2);
}

const browser = await launch();
const page = await browser.newPage();
page.setDefaultTimeout(30000);

page.on("framenavigated", (f) => {
  if (f === page.mainFrame()) console.log("[nav]", f.url().slice(0, 120));
});

await page.goto(url, { waitUntil: "domcontentloaded" });

async function tick(label) {
  await new Promise((r) => setTimeout(r, 1500));
  const state = await page.evaluate(() => ({
    url: location.href,
    body: document.body.innerText.replace(/\s+/g, " ").slice(0, 800),
  }));
  dump(label, state);
  return state;
}

// Step 1: might be a country/language picker, then we land on the test-mode
// quick-fill screen. Click any "Use test data" / "Skip" / "Continue" button.
for (let step = 0; step < 12; step++) {
  const state = await tick(`onboarding-step-${step}`);
  if (state.url.includes("quickarte.fr/settings")) {
    dump("finished", "returned to our return_url");
    break;
  }
  const clicked = await page.evaluate(() => {
    const candidates = [
      ...document.querySelectorAll("button, a, [role=button]"),
    ];
    const priority = [
      /use test phone/i,
      /use test number/i,
      /use test.*data/i,
      /skip (this|account) form/i,
      /agree.*submit/i,
      /^(accept.*terms|agree.*continue)$/i,
      /^submit$/i,
      /^soumettre$/i,
      /^continuer$/i,
      /^continue$/i,
      /^suivant$/i,
      /^next$/i,
      /^(finish|terminer)$/i,
    ];
    for (const rx of priority) {
      const el = candidates.find((c) => {
        const txt = (c.innerText || c.textContent || "").trim();
        return rx.test(txt) && !c.disabled;
      });
      if (el) {
        el.click();
        return (el.innerText || el.textContent || "").trim().slice(0, 60);
      }
    }
    return null;
  });
  dump("clicked", clicked);
  if (!clicked) {
    // Try scrolling to the bottom to expose any sticky CTA.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  }
}

await browser.close();
process.exit(0);
