## 2026-05-19 — Checkout empty-cart redirect after removing last item

### Context

- Overnight final-demo QA on production found a mobile La Bocatería cart edge case: after adding an item, opening checkout, increasing/decreasing quantity, then tapping `Retirer` on the final item, the customer stayed on `/la-bocateria/order?table=22` with an empty checkout instead of returning to the storefront.
- Console and page-error capture were clean; no order was submitted and no customer/merchant data was created.

### Root cause

`components/storefront/checkout-form.tsx` computed `itemCount`, but the empty-cart redirect effect depended on the stable `getItemCount` store function rather than the computed `itemCount` value. Removing the final cart line re-rendered the component, but the effect dependencies did not change, so the redirect did not re-run.

### Changed

- Moved `itemCount`/`total` computation before the redirect effect.
- Changed the effect to check and depend on `itemCount`, so removing the last cart item redirects back to the storefront immediately.
- Added `components/storefront/checkout-form.test.ts` as a focused regression contract and wired it into `npm test`.

### Verification

- `npm test` — 369 passed, 8 skipped, 0 failed.
- `npm run typecheck` — passed.
- `npm run build` — passed.
- Live production browser verification after deploy: `https://quickarte.fr/la-bocateria?table=22` add → checkout → increase → decrease → `Retirer` redirected back to `https://quickarte.fr/la-bocateria` with no console/page errors.

# Changelog

All notable Quickarte production/demo-readiness changes are documented here.

## 2026-05-19 — Catalogue image upload stabilization for La Bocatería demo

### Context

- Final client demo preparation for Quickarte production at `https://quickarte.fr`.
- A manually uploaded catalogue photo appeared to work initially, then failed after save with the global French error page: `Une erreur est survenue`.
- The attached burger image also needed to be seeded into the La Bocatería production catalogue for the `Bocatería burger` product.

### Changed

- Seeded the provided JPEG image into production data for:
  - Business: `La Bocatería`
  - Product: `Bocatería burger`
  - Public storefront: `https://quickarte.fr/la-bocateria`
- Increased Next.js Server Actions payload limit in `next.config.ts`:
  - from the framework default `1mb`
  - to `4mb`
- Kept the existing client-side image guard at `2 MiB` raw file size and schema guard at `2_800_000` serialized data-URL characters.
- Added regression coverage in `components/merchant/catalogue-image-upload.test.ts` to lock the relationship between:
  - real full-tile `input type="file"` upload control;
  - persisted `product.image` create/update path;
  - Server Actions `bodySizeLimit` large enough for the allowed image payload.

### Root cause

Next.js Server Actions default to a `1 MB` request body limit. Quickarte was serializing selected catalogue images into a hidden `data:image/...;base64,...` field and submitting that through a Server Action. Normal phone/gallery images under Quickarte's own `2 MiB` client limit can become larger than `1 MB` after base64 serialization, so Next.js rejected the request before the product action or validation could run.

Production log evidence included:

```text
Body exceeded 1 MB limit.
statusCode: 413
```

### Verification

- Production health check passed:

```text
https://quickarte.fr/api/health → 200
status: ok
DB: connected
```

- Live browser verification on production passed:
  - logged in with a temporary QA account scoped to La Bocatería;
  - opened Catalogue;
  - created a temporary product;
  - uploaded a real JPEG via the visible Photo tile/file input;
  - image size: `1,528,148 bytes` (`>1 MB`, `<2 MiB` client limit);
  - saved successfully without the global `Une erreur est survenue` page;
  - reopened the product and confirmed the image persisted;
  - deleted the temporary product;
  - removed the temporary QA account.
- Public storefront verification passed:
  - `Bocatería burger` appears on `https://quickarte.fr/la-bocateria`;
  - seeded image renders with alt text `Bocatería burger`;
  - image natural size observed as `1024 × 1024`.
- Source validation passed:
  - `npm test`
  - `npm run typecheck`
  - `npm run build`

### Operations

- Deployed manual production container image:

```text
quickarte-manual:catalogue-image-bodylimit-20260519012211
```

- Removed temporary QA artifacts, stopped rollback containers, and temporary QA account after verification.

## 2026-05-19 — French auth error copy for demo login/register flows

### Context

- Overnight final-demo QA on production found that the French login screen rendered Better Auth's raw English provider message after an invalid login attempt: `Invalid email or password`.
- The affected live path was `https://quickarte.fr/login` on mobile viewport. The form stayed functional, but the mixed-language error copy was demo-visible.

### Root cause

`components/auth/login-form.tsx` and `components/auth/register-form.tsx` surfaced `err.message` from `authClient` directly. Better Auth returns some default provider errors in English, so French UI pages could show English failure text.

### Changed

- Added `formatAuthErrorMessage` to translate known auth provider failures to French and fall back to French generic copy for unknown messages.
- Applied the formatter to login and register error handling.
- Added regression coverage for invalid-login, duplicate-account, and unknown-provider auth messages.

### Verification

- Source validation passed:
  - `npm test -- lib/auth/error-messages.test.ts`
  - `npm run typecheck`
  - `npm run build`
- Live production verification before the patch reproduced the English error with an invalid login attempt and no browser console JS exceptions.
