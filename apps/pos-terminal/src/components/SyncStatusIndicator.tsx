import NetInfo from "@react-native-community/netinfo";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSyncStore, type SyncStatus } from "../stores/sync-store";

export function SyncStatusIndicator() {
  const { t } = useTranslation();
  const status = useSyncStore((state) => state.status);
  const outboxCount = useSyncStore((state) => state.outboxCount);
  const setOnline = useSyncStore((state) => state.setOnline);
  const runSync = useSyncStore((state) => state.runSync);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
    });
    return () => unsubscribe();
  }, [setOnline]);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => void runSync()}
      style={[styles.pill, stylesByStatus[status]]}
    >
      <View style={[styles.dot, dotByStatus[status]]} />
      <Text style={styles.text}>
        {t(`pos.sync.${status}`, { count: outboxCount })}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 18,
    paddingHorizontal: 12,
  },
  dot: {
    height: 10,
    width: 10,
    borderRadius: 5,
  },
  text: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "700",
  },
});

const stylesByStatus: Record<SyncStatus, object> = {
  green: { backgroundColor: "#dcfce7" },
  red: { backgroundColor: "#fee2e2" },
  yellow: { backgroundColor: "#fef3c7" },
};

const dotByStatus: Record<SyncStatus, object> = {
  green: { backgroundColor: "#16a34a" },
  red: { backgroundColor: "#dc2626" },
  yellow: { backgroundColor: "#d97706" },
};
