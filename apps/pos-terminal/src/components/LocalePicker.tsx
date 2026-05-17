import { locales, type Locale } from "@quickarte/i18n";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

export function LocalePicker() {
  const { i18n, t } = useTranslation();

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{t("pos.settings.language")}</Text>
      <View style={styles.row}>
        {locales.map((locale) => (
          <Pressable
            key={locale}
            onPress={() => void i18n.changeLanguage(locale)}
            style={[
              styles.option,
              i18n.language === locale ? styles.optionActive : null,
            ]}
          >
            <Text
              style={[
                styles.optionText,
                i18n.language === locale ? styles.optionTextActive : null,
              ]}
            >
              {labelForLocale(locale)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function labelForLocale(locale: Locale): string {
  if (locale === "ar") {
    return "AR";
  }
  if (locale === "darija") {
    return "DA";
  }
  return "FR";
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  label: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  option: {
    minWidth: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionActive: {
    borderColor: "#166534",
    backgroundColor: "#dcfce7",
  },
  optionText: {
    color: "#374151",
    fontWeight: "700",
  },
  optionTextActive: {
    color: "#166534",
  },
});
