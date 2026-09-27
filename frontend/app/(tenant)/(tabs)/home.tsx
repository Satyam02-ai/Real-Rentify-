import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import { Card, Loading, EmptyState, AppButton, StatusChip } from "@/src/components/ui";
import { ScreenScroll } from "@/src/components/layout";
import { Icon } from "@/src/components/Icon";
import { formatMoney, formatDate } from "@/src/utils/format";
import { useTheme, spacing, radius, fontSize } from "@/src/theme";

function QuickAction({ icon, label, onPress, testID }: any) {
  const t = useTheme();
  return (
    <Pressable testID={testID} onPress={onPress} style={{ flex: 1, alignItems: "center", gap: spacing.xs }}>
      <View style={{ width: 56, height: 56, borderRadius: radius.lg, backgroundColor: t.colors.brandTertiary, alignItems: "center", justifyContent: "center" }}>
        <Icon name={icon} size={26} color={t.colors.brandPrimary} />
      </View>
      <Text style={{ fontSize: fontSize.sm, color: t.colors.onSurface, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

export default function TenantHome() {
  const t = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const { data, isLoading, refetch } = useQuery({ queryKey: ["tenant-dashboard"], queryFn: () => api.get("/tenant/dashboard") });

  useFocusEffect(React.useCallback(() => { refetch(); }, [refetch]));

  const onRefresh = async () => { setRefreshing(true); await refetch(); setRefreshing(false); };
  if (isLoading) return <Loading />;

  const inv = data?.next_invoice;

  return (
    <ScreenScroll refreshing={refreshing} onRefresh={onRefresh} contentStyle={{ paddingTop: spacing["3xl"] }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.lg }}>
        <View>
          <Text style={{ color: t.colors.muted, fontSize: fontSize.base }}>Hi {user?.name?.split(" ")[0]},</Text>
          <Text style={{ color: t.colors.onSurface, fontSize: fontSize["2xl"], fontWeight: "900" }}>Welcome home 🏡</Text>
        </View>
        {!user?.aadhaar_verified ? (
          <Pressable testID="verify-aadhaar-chip" onPress={() => router.push("/(tenant)/aadhaar")} style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: t.colors.warning + "22", paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill }}>
            <Icon name="shield-alert-outline" size={16} color={t.colors.warning} />
            <Text style={{ color: t.colors.warning, fontSize: fontSize.sm, fontWeight: "700" }}>Verify KYC</Text>
          </Pressable>
        ) : null}
      </View>

      {inv ? (
        <View style={{ backgroundColor: inv.status === "overdue" ? t.colors.error : t.colors.brandPrimary, borderRadius: radius.lg, padding: spacing.xl, marginBottom: spacing.lg }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: "#fff", opacity: 0.85, fontWeight: "600" }}>{inv.status === "overdue" ? "Overdue rent" : "Rent due"} · {inv.label}</Text>
            <View style={{ backgroundColor: "#ffffff33", paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill }}>
              <Text style={{ color: "#fff", fontSize: fontSize.sm, fontWeight: "700" }}>{inv.status === "overdue" ? "Overdue" : "Due " + formatDate(inv.due_date)}</Text>
            </View>
          </View>
          <Text style={{ color: "#fff", fontSize: 40, fontWeight: "900", marginVertical: spacing.sm }}>{formatMoney(inv.amount)}</Text>
          <Pressable
            testID="pay-rent-btn"
            onPress={() => router.push(`/(tenant)/pay/${inv.id}`)}
            style={{ backgroundColor: "#fff", borderRadius: radius.md, height: 50, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: spacing.sm }}
          >
            <Icon name="cash-fast" size={20} color={inv.status === "overdue" ? t.colors.error : t.colors.brandPrimary} />
            <Text style={{ color: inv.status === "overdue" ? t.colors.error : t.colors.brandPrimary, fontWeight: "800", fontSize: fontSize.lg }}>Pay Now</Text>
          </Pressable>
        </View>
      ) : data?.lease ? (
        <Card style={{ marginBottom: spacing.lg, alignItems: "center", padding: spacing.xl }}>
          <Icon name="check-decagram" size={40} color={t.colors.success} />
          <Text style={{ fontWeight: "800", color: t.colors.onSurface, fontSize: fontSize.lg, marginTop: spacing.sm }}>All rent paid 🎉</Text>
          <Text style={{ color: t.colors.muted, fontSize: fontSize.sm }}>You're all caught up.</Text>
        </Card>
      ) : (
        <Card style={{ marginBottom: spacing.lg }}>
          <EmptyState icon="home-search-outline" title="No active lease" subtitle="Ask your property owner to add you using your signup email." />
        </Card>
      )}

      {/* Quick actions */}
      <Card style={{ marginBottom: spacing.lg }}>
        <View style={{ flexDirection: "row" }}>
          <QuickAction testID="qa-ledger" icon="book-open-variant" label="Ledger" onPress={() => router.push("/(tenant)/(tabs)/ledger")} />
          <QuickAction testID="qa-raise" icon="wrench" label="Raise Issue" onPress={() => router.push("/(tenant)/create-ticket")} />
          <QuickAction testID="qa-alerts" icon="bell" label="Alerts" onPress={() => router.push("/(tenant)/(tabs)/alerts")} />
        </View>
      </Card>

      {data?.lease ? (
        <Card>
          <Text style={{ fontWeight: "800", color: t.colors.onSurface, fontSize: fontSize.lg, marginBottom: spacing.md }}>Your home</Text>
          <Row label="Unit" value={data.unit?.name || "—"} icon="door" />
          <Row label="Monthly rent" value={formatMoney(data.lease.rent_amount)} icon="cash" />
          <Row label="Security deposit" value={formatMoney(data.lease.security_deposit)} icon="shield-account" />
          <Row label="Lease ends" value={formatDate(data.lease.end_date)} icon="calendar-end" last />
        </Card>
      ) : null}
    </ScreenScroll>
  );
}

function Row({ label, value, icon, last }: any) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: spacing.md, gap: spacing.md, borderBottomWidth: last ? 0 : 1, borderBottomColor: t.colors.divider }}>
      <Icon name={icon} size={20} color={t.colors.muted} />
      <Text style={{ flex: 1, color: t.colors.muted, fontSize: fontSize.base }}>{label}</Text>
      <Text style={{ color: t.colors.onSurface, fontWeight: "700", fontSize: fontSize.base }}>{value}</Text>
    </View>
  );
}
