const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:3100";

const expected = new Map([
  ["/sign-in", 404],
  ["/sign-up", 404],
  ["/dashboard", 404],
  ["/admin", 404],
  ["/menu", 404],
  ["/demo", 404],
  ["/tarifs", 404],
  ["/privacy", 404],
  ["/mentions-legales", 200],
  ["/politique-de-confidentialite", 200],
  ["/cgu", 200],
  ["/contact", 200],
  ["/menus", 404],
  ["/items", 404],
  ["/tables", 404],
  ["/qr", 404],
  ["/analytics", 404],
  ["/customers", 404],
  ["/", 200],
]);

let failed = false;

for (const [path, status] of expected) {
  const response = await fetch(new URL(path, baseUrl), { redirect: "manual" });
  const actual = response.status;
  console.log(`${path} ${actual}`);
  if (actual !== status) {
    failed = true;
    console.error(`Expected ${path} to return ${status}, got ${actual}`);
  }
}

if (failed) {
  process.exitCode = 1;
}
