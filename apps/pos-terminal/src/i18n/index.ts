import { I18nManager } from "react-native";
import * as Localization from "expo-localization";
import i18next from "i18next";
import ICU from "i18next-icu";
import { initReactI18next } from "react-i18next";
import { defaultLocale, isLocale, type Locale, loadMessages } from "@quickarte/i18n";

export const i18n = i18next.createInstance();

let initialized = false;

export async function initializeI18n(): Promise<typeof i18n> {
  if (initialized) {
    return i18n;
  }

  const deviceLocale = Localization.getLocales()[0]?.languageCode ?? defaultLocale;
  const locale: Locale = isLocale(deviceLocale) ? deviceLocale : defaultLocale;
  const [fr, ar, darija] = await Promise.all([
    loadMessages("fr"),
    loadMessages("ar"),
    loadMessages("darija"),
  ]);

  await i18n
    .use(ICU)
    .use(initReactI18next)
    .init({
      compatibilityJSON: "v4",
      fallbackLng: defaultLocale,
      lng: locale,
      interpolation: { escapeValue: false },
      resources: {
        ar: { translation: ar },
        darija: { translation: darija },
        fr: { translation: fr },
      },
    });

  I18nManager.forceRTL(locale === "ar");
  i18n.on("languageChanged", (language) => {
    I18nManager.forceRTL(language === "ar");
  });
  initialized = true;
  return i18n;
}
