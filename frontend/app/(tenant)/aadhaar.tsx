import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import { AppButton } from "@/src/components/ui";
import { Field, useToast } from "@/src/components/forms";
import { Icon } from "@/src/components/Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, spacing, radius, fontSize } from "@/src/theme";

export default function Aadhaar() {
  const t = useTheme();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { user, refresh } = useAuth();
  const [step, setStep] = useState<"input" | "otp">("input");
  const [aadhaar, setAadhaar] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  if (user?.aadhaar_verified) {
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.surface, alignItems: "center", justifyContent: "center", padding: spacing.xl }}>
        <Icon name="shield-check" size={64} color={t.colors.success} />
        <Text style={{ fontSize: fontSize.xl, fontWeight: "800", color: t.colors.onSurface, marginTop: spacing.lg }}>Aadhaar Verified</Text>
        <View style={{ height: spacing.xl }} />
        <AppButton testID="aadhaar-continue" title="Continue" onPress={() => router.replace("/")} style={{ alignSelf: "stretch" }} />
      </View>
    );
  }

  async function generate() {
    if (aadhaar.length !== 12) return toast("Enter 12-digit Aadhaar number", "error");
    setLoading(true);
    try {
      await api.post("/aadhaar/generate-otp", { aadhaar });
      toast("OTP sent to Aadhaar-linked mobile", "success");
      setStep("otp");
    } catch (e: any) {
      toast(e.message || "Could not send OTP", "error");
    } finally {
      setLoading(false);
    }
  }

  async function verify() {
    if (otp.length !== 6) return toast("Enter the 6-digit OTP", "error");
    setLoading(true);
    try {
      await api.post("/aadhaar/verify-otp", { otp });
      await refresh();
      toast("Aadhaar verified!", "success");
      router.replace("/");
    } catch (e: any) {
      toast(e.message || "Verification failed", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.surface }}>
      <KeyboardAwareScrollView bottomOffset={20} contentContainerStyle={{ padding: spacing.xl, paddingTop: insets.top + spacing["2xl"] }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: t.colors.brandTertiary, alignItems: "center", justifyContent: "center", marginBottom: spacing.lg }}>
          <Icon name="card-account-details-outline" size={32} color={t.colors.brandPrimary} />
        </View>
        <Text style={{ fontSize: fontSize["2xl"], fontWeight: "900", color: t.colors.onSurface }}>Verify your Aadhaar</Text>
        <Text style={{ fontSize: fontSize.base, color: t.colors.muted, marginBottom: spacing.xl, marginTop: spacing.xs }}>
          Build trust with owners. Verification is secure and optional — you can do it later.
        </Text>

        {step === "input" ? (
          <>
            <Field testID="aadhaar-number" label="Aadhaar number" value={aadhaar} onChangeText={(v) => setAadhaar(v.replace(/[^0-9]/g, ""))} placeholder="1234 5678 9012" keyboardType="number-pad" maxLength={12} icon="numeric" />
            <View style={{ height: spacing.lg }} />
            <AppButton testID="aadhaar-send-otp" title="Send OTP" loading={loading} onPress={generate} />
          </>
        ) : (
          <>
            <Field testID="aadhaar-otp" label="Aadhaar OTP" value={otp} onChangeText={(v) => setOtp(v.replace(/[^0-9]/g, ""))} placeholder="000000" keyboardType="number-pad" maxLength={6} icon="shield-key-outline" />
            <View style={{ height: spacing.lg }} />
            <AppButton testID="aadhaar-verify" title="Verify" loading={loading} onPress={verify} />
          </>
        )}

        <Pressable testID="aadhaar-skip" onPress={() => router.replace("/")} style={{ alignSelf: "center", marginTop: spacing.xl }}>
          <Text style={{ color: t.colors.muted, fontWeight: "600" }}>Skip for now</Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </View>
  );
}
