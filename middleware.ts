import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// QuickArte is now a customer-only storefront: every route is public and
// token-keyed, so there is no merchant session to gate. The middleware is just
// next-intl locale negotiation/routing.
export default createMiddleware(routing);

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
