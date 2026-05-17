import { describe, expect, it } from "vitest";
import { resolveTenantSlugFromHostname } from "./resolve";

describe("resolveTenantSlugFromHostname", () => {
  it("extracts a slug from an lvh.me development hostname", () => {
    expect(resolveTenantSlugFromHostname("cafe-atlas.lvh.me", "lvh.me")).toBe("cafe-atlas");
  });

  it("extracts a slug from a production tenant hostname", () => {
    expect(resolveTenantSlugFromHostname("cafe-atlas.yourapp.ma", "yourapp.ma")).toBe("cafe-atlas");
  });

  it("returns null when the hostname is the root domain", () => {
    expect(resolveTenantSlugFromHostname("yourapp.ma", "yourapp.ma")).toBeNull();
  });
});
