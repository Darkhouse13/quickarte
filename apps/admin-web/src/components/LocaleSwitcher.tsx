import { useTranslation } from "react-i18next";

const locales = ["fr", "ar", "darija"] as const;

export function LocaleSwitcher() {
  const { i18n, t } = useTranslation();

  return (
    <label className="locale-switcher">
      <span>{t("admin.settings.language")}</span>
      <select
        value={i18n.language}
        onChange={(event) => void i18n.changeLanguage(event.target.value)}
      >
        {locales.map((locale) => (
          <option key={locale} value={locale}>
            {locale.toUpperCase()}
          </option>
        ))}
      </select>
    </label>
  );
}
