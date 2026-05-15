import test from "node:test";
import assert from "node:assert/strict";
import { SUBPROCESSORS } from "./subprocessors";

test("the privacy policy lists exactly five sub-processors", () => {
  assert.equal(SUBPROCESSORS.length, 5);
});

test("every sub-processor renders with the correct name and role", () => {
  const byName = new Map(SUBPROCESSORS.map((s) => [s.name, s]));

  assert.equal(
    byName.get("Hetzner Online GmbH")?.role,
    "Hébergement (serveurs et base de données)",
  );
  assert.equal(
    byName.get("Cloudflare, Inc.")?.role,
    "CDN et protection DDoS",
  );
  assert.equal(
    byName.get("Cloudinary Ltd.")?.role,
    "Hébergement des images du catalogue",
  );
  assert.equal(
    byName.get("Resend Inc.")?.role,
    "Envoi des emails transactionnels",
  );
  assert.equal(
    byName.get("Functional Software, Inc. (Sentry)")?.role,
    "Suivi des erreurs techniques",
  );
});

test("every sub-processor has a location and an https website", () => {
  for (const s of SUBPROCESSORS) {
    assert.ok(s.location.length > 0, `${s.name} is missing a location`);
    assert.ok(
      s.website.startsWith("https://"),
      `${s.name} has a non-https website`,
    );
  }
});
