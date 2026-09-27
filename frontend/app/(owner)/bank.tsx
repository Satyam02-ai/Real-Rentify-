import React, { useState } from "react";
import { View, Text } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import { Header } from "@/src/components/layout";
import { Card, AppButton } from "@/src/components/ui";
import { Field, useToast } from "@/src/components/forms";
import { Icon } from "@/src/components/Icon";
import { useTheme, spacing, radius, fontSize } from "@/src/theme";

export default function Bank() {
  const t = useTheme();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { user, refresh } = useAuth();
  const [f, setF] = useState({
    legal_business_name: user?.name || "",
    contact_name: user?.name || "",
    beneficiary_name: user?.name || "",
    ifsc_code: "",
    account_number: "",
    email: user?.email || "",
    phone: user?.phone || "",
  });
  const [loading, setLoading] = useState(false);
  const set = (k: string) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    if (!f.ifsc_code || !f.account_number || !f.beneficiary_name) return toast("Fill bank details", "error");
    setLoading(true);
    try {
      await api.post("/owner/bank", f);
      await refresh();
      qc.invalidateQueries({ queryKey: ["owner-dashboard"] });
      toast("Payout account linked", "success");
      router.back();
    } catch (e: any) {
      toast(e.message || "Could not link account", "error");
    } finally {
      setLoading(false);
    }
  }

  if (user?.has_bank) {
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.surface }}>
        <Header title="Payout Account" onBack />
        <View style={{ padding: spacing.lg }}>
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <View style={{ width: 48, height: 48, borderRadius: radius.md, backgroundColor: t.colors.success + "22", alignItems: "center", justifyContent: "center" }}>
                <Icon name="bank-check" size={26} color={t.colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "800", color: t.colors.onSurface, fontSize: fontSize.lg }}>Account Linked</Text>
                <Text style={{ color: t.colors.muted, fontSize: fontSize.sm }}>Rent collected will auto-settle to your bank via Razorpay Route.</Text>
              </View>
            </View>
          </Card>
          <Text style={{ color: t.colors.muted, fontSize: fontSize.sm, marginTop: spacing.lg, lineHeight: 20 }}>
            Note: Complete Route product activation & KYC in your Razorpay dashboard so transfers settle without being held.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.surface }}>
      <Header title="Set up Auto-Settlement" onBack />
      <KeyboardAwareScrollView bottomOffset={20} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <Card style={{ flexDirection: "row", gap: spacing.md, alignItems: "flex-start" }}>
          <Icon name="information" size={22} color={t.colors.brandPrimary} />
          <Text style={{ flex: 1, color: t.colors.onSurfaceTertiary, fontSize: fontSize.sm, lineHeight: 20 }}>
            Link your bank account so rent paid by tenants is automatically split and settled to you via Razorpay Route — no manual payouts.
          </Text>
        </Card>
        <Field testID="bank-beneficiary" label="Account holder name" value={f.beneficiary_name} onChangeText={set("beneficiary_name")} placeholder="As per bank" autoCapitalize="words" />
        <Field testID="bank-account" label="Account number" value={f.account_number} onChangeText={set("account_number")} placeholder="000111222333" keyboardType="number-pad" />
        <Field testID="bank-ifsc" label="IFSC code" value={f.ifsc_code} onChangeText={(v) => set("ifsc_code")(v.toUpperCase())} placeholder="HDFC0001234" autoCapitalize="characters" />
        <Field testID="bank-email" label="Email" value={f.email} onChangeText={set("email")} placeholder="you@example.com" keyboardType="email-address" />
        <Field testID="bank-phone" label="Phone" value={f.phone} onChangeText={set("phone")} placeholder="9876543210" keyboardType="number-pad" maxLength={10} />
        <AppButton testID="save-bank" title="Link Account" icon="bank" loading={loading} onPress={save} />
      </KeyboardAwareScrollView>
    </View>
  );
}
