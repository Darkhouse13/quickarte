import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// Coolify can briefly route requests between the old and new containers during
// a deployment. A deployment id lets Next.js detect that version skew and use a
// full navigation instead of sending an old RSC payload to the new build.
const deploymentId =
  process.env.NEXT_DEPLOYMENT_ID ??
  process.env.COOLIFY_GIT_COMMIT_SHA ??
  process.env.SOURCE_COMMIT;

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.sentry.io",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://images.unsplash.com https://res.cloudinary.com https://mizane.xyz",
      "font-src 'self' data:",
      "connect-src 'self' https://*.sentry.io",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  deploymentId,
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
  reactStrictMode: true,
  outputFileTracingRoot: __dirname,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "mizane.xyz" },
    ],
  },
};

// Sentry wrapper. Source-map upload runs only when SENTRY_AUTH_TOKEN is set
// at build time; in dev or builds without the token it is skipped silently.
export default withSentryConfig(withNextIntl(nextConfig), {
  silent: !process.env.CI,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  disableLogger: true,
  telemetry: false,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});
