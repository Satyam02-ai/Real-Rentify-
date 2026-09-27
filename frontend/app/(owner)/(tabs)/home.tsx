import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import { Card, Loading, EmptyState, AppButton } from "@/src/components/ui";
import { ScreenScroll } from "@/src/components/layout";
import { Icon } from "@/src/components/Icon";
import { formatMoney, formatMoneyShort } from "@/src/utils/format";
import { useTheme, spacing, radius, fontSize } from "@/src/theme";

function StatCard({ icon, label, value, tone }: { icon: string; label: string; value: string; tone: string }) {
  const t = useTheme();
  const color = (t.colors as any)[tone] as string;
  return (
    <Card style={{ flex: 1 }}>
      <View style={{ width: 38, height: 38, borderRadius: radius.sm, backgroundColor: color + "22", alignItems: "center", justifyContent: "center", marginBottom: spacing.sm }}>
        <Icon name={icon} size={20} color={color} />
      </View>
      <Text style={{ fontSize: fontSize["xl"], fontWeight: "900", color: t.colors.onSurface }}>{value}</Text>
      <Text style={{ fontSize: fontSize.sm, color: t.colors.muted, marginTop: 2 }}>{label}</Text>
    </Card>
  );
}

function ActionRow({ icon, tone, title, count, amount, onPress }: any) {
  const t = useTheme();
  const color = (t.colors as any)[tone] as string;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        minHeight: 60,
        paddingVertical: spacing.md,
        opacity: pressed ? 0.7 : 1,
        gap: spacing.md,
      })}
    >
      <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: color + "22", alignItems: "center", justifyContent: "center" }}>
        <Icon name={icon} size={22} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: fontSize.lg, fontWeight: "600", color: t.colors.onSurface }}>{title}</Text>
        {amount ? <Text style={{ fontSize: fontSize.sm, color: t.colors.muted }}>{amount}</Text> : null}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <View style={{ minWidth: 28, height: 28, borderRadius: 14, backgroundColor: count > 0 ? color : t.colors.surfaceTertiary, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 }}>
          <Text style={{ color: count > 0 ? "#fff" : t.colors.muted, fontWeight: "800", fontSize: fontSize.sm }}>{count}</Text>
        </View>
        <Icon name="chevron-right" size={22} color={t.colors.muted} />
      </View>
    </Pressable>
  );
}

export default function OwnerHome() {
  const t = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["owner-dashboard"],
    queryFn: () => api.get("/owner/dashboard"),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (isLoading) return <Loading />;

  const noUnits = (data?.total_units ?? 0) === 0;
  const today = data?.today ?? {};

  return (
    <ScreenScroll refreshing={refreshing} onRefresh={onRefresh} contentStyle={{ paddingTop: spacing["3xl"] }}>
      <Text style={{ color: t.colors.muted, fontSize: fontSize.base }}>Welcome back,</Text>
      <Text style={{ color: t.colors.onSurface, fontSize: fontSize["2xl"], fontWeight: "900", marginBottom: spacing.lg }}>
        {user?.name?.split(" ")[0] || "Owner"} 👋
      </Text>

      {/* Revenue hero card */}
      <View style={{ backgroundColor: t.colors.brandPrimary, borderRadius: radius.lg, padding: spacing.xl, marginBottom: spacing.md }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: t.colors.onBrandPrimary, opacity: 0.85, fontSize: fontSize.base, fontWeight: "600" }}>Revenue this month</Text>
          <Icon name="trending-up" size={22} color={t.colors.onBrandPrimary} />
        </View>
        <Text style={{ color: t.colors.onBrandPrimary, fontSize: 40, fontWeight: "900", marginTop: spacing.sm }}>
          {formatMoney(data?.revenue_month)}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm }}>
          <Icon name="home-group" size={16} color={t.colors.onBrandPrimary} />
          <Text style={{ color: t.colors.onBrandPrimary, opacity: 0.85, fontSize: fontSize.sm }}>
            {data?.occupancy_pct ?? 0}% occupancy · {data?.occupied_units ?? 0}/{data?.total_units ?? 0} units
          </Text>
        </View>
      </View>

      {noUnits ? (
        <Card style={{ marginBottom: spacing.md }}>
          <EmptyState icon="home-plus-outline" title="Add your first property" subtitle="Create a property and units to start tracking rent and revenue." />
          <AppButton testID="empty-add-property" title="Add Property" icon="plus" onPress={() => router.push("/(owner)/add-property")} />
        </Card>
      ) : (
        <>
          <View style={{ flexDirection: "row", gap: spacing.md, marginBottom: spacing.md }}>
            <StatCard icon="clock-alert-outline" tone="warning" label="Pending Rent" value={formatMoneyShort(data?.pending_rent)} />
            <StatCard icon="home-city" tone="success" label="Occupied Units" value={String(data?.occupied_units ?? 0)} />
          </View>
          <View style={{ flexDirection: "row", gap: spacing.md, marginBottom: spacing.xl }}>
            <StatCard icon="home-outline" tone="info" label="Vacant Units" value={String(data?.vacant_units ?? 0)} />
            <StatCard icon="chart-line" tone="brandPrimary" label="Total Units" value={String(data?.total_units ?? 0)} />
          </View>
        </>
      )}

      {/* Today's Actions */}
      <Text style={{ fontSize: fontSize.xl, fontWeight: "800", color: t.colors.onSurface, marginBottom: spacing.sm }}>Today's Actions</Text>
      <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
        <ActionRow icon="calendar-today" tone="warning" title="Rents Due Today" count={today.due_today ?? 0} onPress={() => router.push("/(owner)/finances")} />
        <View style={{ height: 1, backgroundColor: t.colors.divider }} />
        <ActionRow icon="alert-circle-outline" tone="error" title="Overdue Rent" amount={today.overdue_amount ? formatMoney(today.overdue_amount) : undefined} count={today.overdue ?? 0} onPress={() => router.push("/(owner)/finances")} />
        <View style={{ height: 1, backgroundColor: t.colors.divider }} />
        <ActionRow icon="wrench-outline" tone="info" title="Maintenance Requests" count={today.open_tickets ?? 0} onPress={() => router.push("/(owner)/tickets")} />
        <View style={{ height: 1, backgroundColor: t.colors.divider }} />
        <ActionRow icon="file-clock-outline" tone="brandPrimary" title="Agreements Expiring" count={today.expiring_leases ?? 0} onPress={() => router.push("/(owner)/(tabs)/properties")} />
      </Card>

      <View style={{ height: spacing.md }} />
      <AppButton testID="home-add-property" title="Add Property" icon="plus" variant="secondary" onPress={() => router.push("/(owner)/add-property")} />
    </ScreenScroll>
  );
}
