import React from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import { Card } from "@/src/components/ui";
import { Header, ScreenScroll } from "@/src/components/layout";
import { Icon } from "@/src/components/Icon";
import { useTheme, spacing, radius, fontSize } from "@/src/theme";

function Row({ icon, title, subtitle, onPress, badge, danger }: any) {
  const t = useTheme();
  return (
    <Pressable testID={`more-${title}`} onPress={onPress} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", paddingVertical: spacing.md, gap: spacing.md, opacity: pressed ? 0.7 : 1 })}>
      <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: danger ? t.colors.error + "22" : t.colors.brandTertiary, alignItems: "center", justifyContent: "center" }}>
        <Icon name={icon} size={20} color={danger ? t.colors.error : t.colors.brandPrimary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: fontSize.lg, fontWeight: "600", color: danger ? t.colors.error : t.colors.onSurface }}>{title}</Text>
        {subtitle ? <Text style={{ fontSize: fontSize.sm, color: t.colors.muted }}>{subtitle}</Text> : null}
      </View>
      {badge ? (
        <View style={{ minWidth: 22, height: 22, borderRadius: 11, backgroundColor: t.colors.error, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 }}>
          <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>{badge}</Text>
        </View>
      ) : (
        <Icon name="chevron-right" size={22} color={t.colors.muted} />
      )}
    </Pressable>
  );
}

export default function More() {
  const t = useTheme();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const notifs = useQuery({ queryKey: ["notifications"], queryFn: () => api.get("/notifications") });

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.surface }}>
      <Header title="More" />
      <ScreenScroll>
        <Card style={{ marginBottom: spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: t.colors.brandPrimary, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: t.colors.onBrandPrimary, fontSize: fontSize.xl, fontWeight: "900" }}>{user?.name?.[0]?.toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: fontSize.lg, fontWeight: "800", color: t.colors.onSurface }}>{user?.name}</Text>
            <Text style={{ fontSize: fontSize.sm, color: t.colors.muted }}>{user?.email}</Text>
          </View>
        </Card>

        <Card padded={false} style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}>
          <Row icon="bell-outline" title="Notifications" badge={notifs.data?.unread || undefined} onPress={() => router.push("/(owner)/notifications")} />
          <View style={{ height: 1, backgroundColor: t.colors.divider }} />
          <Row icon="wrench-outline" title="Maintenance Tickets" onPress={() => router.push("/(owner)/tickets")} />
          <View style={{ height: 1, backgroundColor: t.colors.divider }} />
          <Row icon="shield-account-outline" title="Security Deposits" onPress={() => router.push("/(owner)/deposits")} />
          <View style={{ height: 1, backgroundColor: t.colors.divider }} />
          <Row icon="bank-outline" title="Bank / Payout Account" subtitle={user?.has_bank ? "Linked ✓" : "Set up auto-settlement"} onPress={() => router.push("/(owner)/bank")} />
        </Card>

        <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
          <Row icon="logout" title="Log Out" danger onPress={signOut} />
        </Card>
      </ScreenScroll>
    </View>
  );
}
