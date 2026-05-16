import { defineRouting } from "next-intl/routing";
import { defaultLocale, locales, type Locale } from "@quickarte/i18n";

type QuickarteLocale = Exclude<Locale, "darija">;

const quickarteLocales = locales.filter(
  (locale): locale is QuickarteLocale => locale !== "darija",
);

export const routing = defineRouting({
  locales: quickarteLocales,
  defaultLocale,
  localePrefix: "as-needed",
});

export type AppLocale = (typeof routing.locales)[number];
