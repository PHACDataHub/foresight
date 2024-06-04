import createMiddleware from "next-intl/middleware";
import { type NextRequest } from "next/server";

import { locales } from "./i18n";

export default async function middleware(request: NextRequest) {
  const handleI18nRouting = createMiddleware({
    locales,
    defaultLocale: "en-CA",
    localeDetection: false,
  });
  const response = handleI18nRouting(request);

  return response;
}

export const config = {
  // Match only internationalized pathnames
  matcher: ["/(en-CA|fr-CA)/:path*"],
};
