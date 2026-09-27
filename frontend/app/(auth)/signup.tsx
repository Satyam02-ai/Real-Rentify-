import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api/client";
import { AppButton } from "@/src/components/ui";
import { Field, useToast } from "@/src/components/forms";
import { Icon } from "@/src/components/Icon";
import { useTheme, spacing, radius, fontSize } from "@/src/theme";

type Role = "owner" | "tenant";

export default function Signup() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [role, setRole] = useState<Role>("owner");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSignup() {
    if (!name || !email || !phone || !password) return toast("Please fill all fields", "error");
    if (password.length < 6) return toast("Password must be at least 6 characters", "error");
    setLoading(true);
    try {
      await api.post("/auth/signup", { name, email, phone, password, role });
      toast("Verification code sent to your email", "success");
      router.push({ pathname: "/(auth)/verify", params: { email, role } });
    } catch (e: any) {
      toast(e.message || "Signup failed", "error");
    } finally {
      setLoading(false);
    }
  }

  const roles: { value: Role; label: string; icon: string; desc: string }[] = [
    { value: "owner", label: "Property Owner", icon: "home-city", desc: "Manage properties & rent" },
    { value: "tenant", label: "Tenant", icon: "account", desc: "Pay rent & raise requests" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.surface }}>
      <KeyboardAwareScrollView
        bottomOffset={20}
        contentContainerStyle={{ padding: spacing.xl, paddingTop: insets.top + spacing["2xl"], paddingBottom: spacing["3xl"] }}
      >
        <Pressable testID="back-btn" onPress={() => router.back()} hitSlop={12} style={{ marginBottom: spacing.lg }}>
          <Icon name="arrow-left" size={26} color={t.colors.onSurface} />
        </Pressable>
        <Text style={{ fontSize: fontSize["2xl"], fontWeight: "900", color: t.colors.onSurface }}>Create account</Text>
        <Text style={{ fontSize: fontSize.base, color: t.colors.muted, marginBottom: spacing.lg, marginTop: spacing.xs }}>
          Choose how you'll use Rentify
        </Text>

        <View style={{ flexDirection: "row", gap: spacing.md, marginBottom: spacing.xl }}>
          {roles.map((r) => {
            const active = role === r.value;
            return (
              <Pressable
                key={r.value}
                testID={`role-${r.value}`}
                onPress={() => setRole(r.value)}
                style={{
                  flex: 1,
                  borderWidth: 2,
                  borderColor: active ? t.colors.brandPrimary : t.colors.border,
                  backgroundColor: active ? t.colors.brandTertiary : t.colors.surfaceSecondary,
                  borderRadius: radius.lg,
                  padding: spacing.lg,
                  gap: spacing.xs,
                }}
              >
                <Icon name={r.icon} size={28} color={active ? t.colors.brandPrimary : t.colors.muted} />
                <Text style={{ fontWeight: "800", color: t.colors.onSurface, fontSize: fontSize.base }}>{r.label}</Text>
                <Text style={{ color: t.colors.muted, fontSize: fontSize.sm }}>{r.desc}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ gap: spacing.lg }}>
          <Field testID="signup-name" label="Full name" value={name} onChangeText={setName} placeholder="Rahul Sharma" autoCapitalize="words" icon="account-outline" />
          <Field testID="signup-email" label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" icon="email-outline" />
          <Field testID="signup-phone" label="Phone (WhatsApp)" value={phone} onChangeText={(v) => setPhone(v.replace(/[^0-9]/g, ""))} placeholder="9876543210" keyboardType="number-pad" maxLength={10} icon="phone-outline" />
          <Field testID="signup-password" label="Password" value={password} onChangeText={setPassword} placeholder="Min 6 characters" secureTextEntry icon="lock-outline" />
          <AppButton testID="signup-submit" title="Continue" loading={loading} onPress={onSignup} />
          <Pressable testID="go-login" onPress={() => router.replace("/(auth)/login")} style={{ alignSelf: "center", marginTop: spacing.sm }}>
            <Text style={{ color: t.colors.muted }}>
              Already have an account? <Text style={{ color: t.colors.brandPrimary, fontWeight: "700" }}>Log in</Text>
            </Text>
          </Pressable>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}
