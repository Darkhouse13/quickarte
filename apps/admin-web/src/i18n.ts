import i18next from "i18next";
import ICU from "i18next-icu";
import { initReactI18next } from "react-i18next";
import ar from "@quickarte/i18n/messages/ar.json";
import darija from "@quickarte/i18n/messages/darija.json";
import fr from "@quickarte/i18n/messages/fr.json";

const resources = {
  ar: { translation: ar },
  darija: { translation: darija },
  fr: { translation: fr },
};

void i18next
  .use(ICU)
  .use(initReactI18next)
  .init({
    resources,
    lng: resolveInitialLanguage(),
    fallbackLng: "fr",
    interpolation: { escapeValue: false },
  });

i18next.on("languageChanged", applyDocumentDirection);
applyDocumentDirection(i18next.language);

function resolveInitialLanguage(): "fr" | "ar" | "darija" {
  const language = window.localStorage.getItem("quickarte.admin.locale");
  if (language === "ar" || language === "darija" || language === "fr") {
    return language;
  }
  return navigator.language.toLowerCase().startsWith("ar") ? "ar" : "fr";
}

function applyDocumentDirection(language: string): void {
  const isRtl = language === "ar";
  document.documentElement.lang = language;
  document.documentElement.dir = isRtl ? "rtl" : "ltr";
  document.body.classList.toggle("dir-rtl", isRtl);
  window.localStorage.setItem("quickarte.admin.locale", language);
}
