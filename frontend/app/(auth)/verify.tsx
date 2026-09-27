import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import { AppButton } from "@/src/components/ui";
import { Field, useToast } from "@/src/components/forms";
import { Icon } from "@/src/components/Icon";
import { useTheme, spacing, fontSize } from "@/src/theme";

export default function Verify() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { signIn } = useAuth();
  const { email, role } = useLocalSearchParams<{ email: string; role?: string }>();
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  async function onVerify() {
    if (otp.length !== 6) return toast("Enter the 6-digit code", "error");
    setLoading(true);
    try {
      const res = await api.post("/auth/verify-email", { email, otp });
      await signIn(res.access_token, res.user);
      toast("Email verified!", "success");
      if (res.user.role === "tenant") {
        router.replace("/(tenant)/aadhaar");
      } else {
        router.replace("/");
      }
    } catch (e: any) {
      toast(e.message || "Verification failed", "error");
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    try {
      await api.post("/auth/resend-otp", { email });
      toast("New code sent", "success");
    } catch (e: any) {
      toast(e.message || "Could not resend", "error");
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.surface }}>
      <KeyboardAwareScrollView bottomOffset={20} contentContainerStyle={{ padding: spacing.xl, paddingTop: insets.top + spacing["2xl"] }}>
        <Pressable testID="back-btn" onPress={() => router.back()} hitSlop={12} style={{ marginBottom: spacing.lg }}>
          <Icon name="arrow-left" size={26} color={t.colors.onSurface} />
        </Pressable>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: t.colors.brandTertiary, alignItems: "center", justifyContent: "center", marginBottom: spacing.lg }}>
          <Icon name="email-check-outline" size={32} color={t.colors.brandPrimary} />
        </View>
        <Text style={{ fontSize: fontSize["2xl"], fontWeight: "900", color: t.colors.onSurface }}>Verify your email</Text>
        <Text style={{ fontSize: fontSize.base, color: t.colors.muted, marginBottom: spacing.xl, marginTop: spacing.xs }}>
          Enter the 6-digit code sent to {email}
        </Text>
        <Field
          testID="verify-otp"
          label="Verification code"
          value={otp}
          onChangeText={(v) => setOtp(v.replace(/[^0-9]/g, ""))}
          placeholder="000000"
          keyboardType="number-pad"
          maxLength={6}
          icon="shield-key-outline"
        />
        <View style={{ height: spacing.lg }} />
        <AppButton testID="verify-submit" title="Verify" loading={loading} onPress={onVerify} />
        <Pressable testID="resend-otp" onPress={onResend} style={{ alignSelf: "center", marginTop: spacing.lg }}>
          <Text style={{ color: t.colors.brandPrimary, fontWeight: "700" }}>Resend code</Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </View>
  );
}
