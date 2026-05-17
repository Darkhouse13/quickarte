import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LocalePicker } from "../../src/components/LocalePicker";
import { SyncStatusIndicator } from "../../src/components/SyncStatusIndicator";
import { useAuthStore } from "../../src/stores/auth-store";
import { useBusinessStore } from "../../src/stores/business-store";
import { useSyncStore } from "../../src/stores/sync-store";

export default function HomeScreen() {
  const { t } = useTranslation();
  const signOut = useAuthStore((state) => state.signOut);
  const businessName = useBusinessStore((state) => state.businessName);
  const staffDisplayName = useBusinessStore((state) => state.staffDisplayName);
  const runSync = useSyncStore((state) => state.runSync);

  useEffect(() => {
    void runSync();
    const interval = setInterval(() => {
      void runSync();
    }, 30_000);
    return () => clearInterval(interval);
  }, [runSync]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>{t("pos.home.terminal")}</Text>
          <Text style={styles.title}>
            {businessName || t("pos.home.noBusiness")}
          </Text>
          <Text style={styles.subtitle}>
            {staffDisplayName || t("pos.home.noStaff")}
          </Text>
        </View>
        <SyncStatusIndicator />
      </View>
      <LocalePicker />
      <Pressable style={styles.secondaryButton} onPress={() => void runSync()}>
        <Text style={styles.secondaryButtonText}>{t("pos.sync.syncNow")}</Text>
      </Pressable>
      <Pressable style={styles.signOutButton} onPress={() => void signOut()}>
        <Text style={styles.signOutText}>{t("pos.home.signOut")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    gap: 18,
    padding: 24,
    backgroundColor: "#f7f8fa",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
  },
  eyebrow: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  title: {
    color: "#111827",
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    marginTop: 4,
    color: "#4b5563",
    fontSize: 16,
  },
  secondaryButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#166534",
  },
  secondaryButtonText: {
    color: "#166534",
    fontSize: 16,
    fontWeight: "700",
  },
  signOutButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    backgroundColor: "#111827",
  },
  signOutText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
});
