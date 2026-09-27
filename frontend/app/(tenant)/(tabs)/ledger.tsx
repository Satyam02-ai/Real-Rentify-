import React from "react";
import { View, Text, FlatList } from "react-native";
import { useFocusEffect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api/client";
import { Header } from "@/src/components/layout";
import { Card, Loading, EmptyState, StatusChip } from "@/src/components/ui";
import { Icon } from "@/src/components/Icon";
import { formatMoney, formatDate } from "@/src/utils/format";
import { useTheme, spacing, radius, fontSize } from "@/src/theme";

const META: Record<string, { icon: string; tone: string; sign: string }> = {
  charge: { icon: "arrow-up-circle", tone: "warning", sign: "" },
  payment: { icon: "arrow-down-circle", tone: "success", sign: "-" },
  deposit: { icon: "shield-account", tone: "info", sign: "" },
  deduction: { icon: "minus-circle", tone: "warning", sign: "" },
  refund: { icon: "cash-refund", tone: "success", sign: "-" },
};

export default function Ledger() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { data, isLoading, refetch } = useQuery({ queryKey: ["ledger"], queryFn: () => api.get("/tenant/ledger") });
  useFocusEffect(React.useCallback(() => { refetch(); }, [refetch]));

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.surface }}>
      <Header title="Tenant Ledger" />
      {isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={data?.entries || []}
          keyExtractor={(e, i) => e.id + i}
          refreshing={false}
          onRefresh={refetch}
          ListHeaderComponent={
            <View style={{ backgroundColor: t.colors.surfaceInverse, borderRadius: radius.lg, padding: spacing.xl, marginBottom: spacing.lg }}>
              <Text style={{ color: t.colors.onSurfaceInverse, opacity: 0.8, fontWeight: "600" }}>Outstanding balance</Text>
              <Text style={{ color: t.colors.onSurfaceInverse, fontSize: 36, fontWeight: "900", marginTop: spacing.xs }}>{formatMoney(data?.outstanding)}</Text>
            </View>
          }
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 100 }}
          ListEmptyComponent={<EmptyState icon="book-open-variant" title="No transactions yet" subtitle="Your rent charges and payments will appear here." />}
          renderItem={({ item }) => {
            const m = META[item.type] || META.charge;
            const color = (t.colors as any)[m.tone] as string;
            return (
              <Card style={{ marginBottom: spacing.sm }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                  <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: color + "22", alignItems: "center", justifyContent: "center" }}>
                    <Icon name={m.icon} size={22} color={color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "700", color: t.colors.onSurface }}>{item.title}</Text>
                    <Text style={{ fontSize: fontSize.sm, color: t.colors.muted }}>{formatDate(item.date)}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <Text style={{ fontWeight: "900", color: m.sign ? t.colors.success : t.colors.onSurface }}>{m.sign}{formatMoney(item.amount)}</Text>
                    <StatusChip status={item.status} />
                  </View>
                </View>
              </Card>
            );
          }}
        />
      )}
    </View>
  );
}
