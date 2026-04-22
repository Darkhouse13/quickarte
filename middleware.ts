import createMiddleware from "next-intl/middleware";
import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

const MERCHANT_PATHS = [
  "/home",
  "/catalog",
  "/orders",
  "/loyalty",
  "/settings",
  "/onboarding",
];

function stripLocale(pathname: string): string {
  for (const locale of routing.locales) {
    if (pathname === `/${locale}`) return "/";
    if (pathname.startsWith(`/${locale}/`)) {
      return pathname.slice(`/${locale}`.length);
    }
  }
  return pathname;
}

function matchesAny(path: string, roots: string[]): boolean {
  return roots.some((r) => path === r || path.startsWith(`${r}/`));
}

export default function middleware(req: NextRequest) {
  const path = stripLocale(req.nextUrl.pathname);

  if (matchesAny(path, MERCHANT_PATHS)) {
    const session = getSessionCookie(req);
    if (!session) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return intlMiddleware(req);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
