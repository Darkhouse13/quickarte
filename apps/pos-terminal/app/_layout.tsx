import { Slot } from "expo-router";
import { useEffect } from "react";
import { I18nextProvider } from "react-i18next";
import { AppState } from "react-native";
import { i18n, initializeI18n } from "../src/i18n";
import { useSyncStore } from "../src/stores/sync-store";

export default function RootLayout() {
  const runSync = useSyncStore((state) => state.runSync);

  useEffect(() => {
    void initializeI18n();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void runSync();
      }
    });
    return () => subscription.remove();
  }, [runSync]);

  return (
    <I18nextProvider i18n={i18n}>
      <Slot />
    </I18nextProvider>
  );
}
