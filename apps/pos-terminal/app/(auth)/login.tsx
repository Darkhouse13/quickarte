import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuthStore } from "../../src/stores/auth-store";

export default function LoginScreen() {
  const { t } = useTranslation();
  const login = useAuthStore((state) => state.login);
  const loading = useAuthStore((state) => state.loading);
  const [businessId, setBusinessId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    const result = await login({ businessId: businessId.trim(), pin });
    if (!result.ok) {
      setError(
        result.retryAfterSeconds
          ? t("pos.auth.rateLimited", { seconds: result.retryAfterSeconds })
          : t("pos.auth.invalidPin"),
      );
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.screen}
    >
      <View style={styles.panel}>
        <Text style={styles.title}>{t("pos.auth.title")}</Text>
        <Text style={styles.label}>{t("pos.auth.businessId")}</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setBusinessId}
          placeholder={t("pos.auth.businessIdPlaceholder")}
          style={styles.input}
          value={businessId}
        />
        <Text style={styles.label}>{t("pos.auth.pin")}</Text>
        <TextInput
          keyboardType="number-pad"
          maxLength={6}
          onChangeText={setPin}
          placeholder={t("pos.auth.pinPlaceholder")}
          secureTextEntry
          style={styles.input}
          value={pin}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          disabled={loading || businessId.trim().length === 0 || pin.length < 4}
          onPress={() => void submit()}
          style={({ pressed }) => [
            styles.button,
            pressed ? styles.buttonPressed : null,
            loading ? styles.buttonDisabled : null,
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>{t("pos.auth.signIn")}</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f7f8fa",
  },
  panel: {
    gap: 12,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    padding: 20,
  },
  title: {
    color: "#111827",
    fontSize: 24,
    fontWeight: "700",
  },
  label: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "600",
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    paddingHorizontal: 12,
    color: "#111827",
  },
  error: {
    color: "#b91c1c",
    fontSize: 14,
  },
  button: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    backgroundColor: "#166534",
  },
  buttonPressed: {
    opacity: 0.86,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
});
