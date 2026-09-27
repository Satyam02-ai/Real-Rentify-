import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, saveToken } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import { AppButton } from "@/src/components/ui";
import { Field, useToast } from "@/src/components/forms";
import { Icon } from "@/src/components/Icon";
import { useTheme, spacing, fontSize } from "@/src/theme";

export default function Login() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onLogin() {
    if (!email || !password) return toast("Enter email and password", "error");
    setLoading(true);
    try {
      const res = await api.post("/auth/login", { email, password });
      await signIn(res.access_token, res.user);
      router.replace("/");
    } catch (e: any) {
      if (e.status === 403) {
        await api.post("/auth/resend-otp", { email }).catch(() => {});
        toast("Verify your email to continue", "info");
        router.push({ pathname: "/(auth)/verify", params: { email } });
      } else {
        toast(e.message || "Login failed", "error");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.surface }}>
      <KeyboardAwareScrollView
        bottomOffset={20}
        contentContainerStyle={{ padding: spacing.xl, paddingTop: insets.top + spacing["2xl"] }}
      >
        <Pressable testID="back-btn" onPress={() => router.back()} hitSlop={12} style={{ marginBottom: spacing.lg }}>
          <Icon name="arrow-left" size={26} color={t.colors.onSurface} />
        </Pressable>
        <Text style={{ fontSize: fontSize["2xl"], fontWeight: "900", color: t.colors.onSurface }}>Welcome back</Text>
        <Text style={{ fontSize: fontSize.base, color: t.colors.muted, marginBottom: spacing.xl, marginTop: spacing.xs }}>
          Log in to your Rentify account
        </Text>
        <View style={{ gap: spacing.lg }}>
          <Field
            testID="login-email"
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            icon="email-outline"
          />
          <Field
            testID="login-password"
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            icon="lock-outline"
          />
          <AppButton testID="login-submit" title="Log In" loading={loading} onPress={onLogin} />
          <Pressable testID="go-signup" onPress={() => router.replace("/(auth)/signup")} style={{ alignSelf: "center", marginTop: spacing.sm }}>
            <Text style={{ color: t.colors.muted }}>
              New to Rentify? <Text style={{ color: t.colors.brandPrimary, fontWeight: "700" }}>Create account</Text>
            </Text>
          </Pressable>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}
