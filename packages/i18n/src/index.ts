import ar from "../messages/ar.json";
import darija from "../messages/darija.json";
import fr from "../messages/fr.json";

export const locales = ["fr", "ar", "darija"] as const;
export const defaultLocale = "fr";

export type Locale = (typeof locales)[number];
export type MessageValue = string | { [key: string]: MessageValue };
export type Messages = Record<string, MessageValue>;

const messagesByLocale: Record<Locale, Messages> = {
  ar,
  darija,
  fr,
};

export function isLocale(value: string | undefined): value is Locale {
  return locales.includes(value as Locale);
}

export async function loadMessages(locale: Locale): Promise<Messages> {
  return messagesByLocale[locale];
}
