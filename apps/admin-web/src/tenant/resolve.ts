export type TenantResolution = {
  slug: string | null;
  tenantRequired: boolean;
};

export function resolveTenantSlugFromHostname(
  hostname: string,
  rootDomain: string,
): string | null {
  const normalizedHost = hostname.split(":")[0]?.toLowerCase() ?? "";
  const normalizedRoot = rootDomain.toLowerCase();

  if (normalizedHost === normalizedRoot) {
    return null;
  }

  const suffix = `.${normalizedRoot}`;
  if (!normalizedHost.endsWith(suffix)) {
    return null;
  }

  const slug = normalizedHost.slice(0, -suffix.length);
  return slug.length > 0 && !slug.includes(".") ? slug : null;
}

export function resolveTenantFromLocation(location: Location): TenantResolution {
  const hostname = location.hostname;
  const rootDomain = import.meta.env.VITE_TENANT_ROOT_DOMAIN ?? "lvh.me";

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return {
      slug: import.meta.env.VITE_DEV_TENANT_SLUG ?? "cafe-atlas",
      tenantRequired: false,
    };
  }

  const slug = resolveTenantSlugFromHostname(hostname, rootDomain);
  return { slug, tenantRequired: !slug };
}
