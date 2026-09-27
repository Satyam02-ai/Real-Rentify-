import React, { useState } from "react";
import { View, Text, Pressable, FlatList } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api/client";
import { Loading, EmptyState, StatusChip, SegmentedControl } from "@/src/components/ui";
import { Card } from "@/src/components/ui";
import { Icon } from "@/src/components/Icon";
import { fromNow } from "@/src/utils/format";
import { useTheme, spacing, radius, fontSize } from "@/src/theme";

export function TicketsList({ role, detailBase }: { role: "owner" | "tenant"; detailBase: string }) {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState("open");
  const { data, isLoading, refetch } = useQuery({ queryKey: ["tickets"], queryFn: () => api.get("/tickets") });

  useFocusEffect(React.useCallback(() => { refetch(); }, [refetch]));

  const filtered = (data || []).filter((tk: any) => (filter === "all" ? true : tk.status === filter));

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.surface }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: t.colors.surface }}>
        <SegmentedControl
          value={filter}
          onChange={setFilter}
          options={[
            { label: "Open", value: "open" },
            { label: "In Progress", value: "in_progress" },
            { label: "Resolved", value: "resolved" },
            { label: "All", value: "all" },
          ]}
        />
      </View>
      {isLoading ? (
        <Loading />
      ) : filtered.length === 0 ? (
        <EmptyState icon="wrench-outline" title="No requests here" subtitle="Maintenance requests will show up here." />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(tk) => tk.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + 100 }}
          renderItem={({ item }) => (
            <Pressable testID={`ticket-${item.id}`} onPress={() => router.push(`${detailBase}/${item.id}` as any)}>
              <Card>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flex: 1, paddingRight: spacing.md }}>
                    <Text style={{ fontSize: fontSize.sm, color: t.colors.brandPrimary, fontWeight: "700" }}>{item.ticket_no}</Text>
                    <Text style={{ fontSize: fontSize.lg, fontWeight: "700", color: t.colors.onSurface, marginTop: 2 }}>{item.title}</Text>
                    <Text style={{ fontSize: fontSize.sm, color: t.colors.muted, marginTop: 2 }}>{item.property_name} · {fromNow(item.created_at)}</Text>
                  </View>
                  <StatusChip status={item.priority} />
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.md }}>
                  <StatusChip status={item.status} />
                  {role === "owner" ? <Text style={{ fontSize: fontSize.sm, color: t.colors.muted }}>by {item.raised_by}</Text> : null}
                </View>
              </Card>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
