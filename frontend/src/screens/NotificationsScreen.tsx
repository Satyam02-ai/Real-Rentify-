import React from "react";
import { View, Text, Pressable, FlatList } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api/client";
import { Header } from "@/src/components/layout";
import { Loading, EmptyState } from "@/src/components/ui";
import { Icon } from "@/src/components/Icon";
import { fromNow } from "@/src/utils/format";
import { useTheme, spacing, radius, fontSize } from "@/src/theme";

const ICONS: Record<string, string> = {
  rent: "cash-clock",
  payment: "check-decagram",
  maintenance: "wrench",
  deposit: "shield-account",
  lease: "file-document",
  info: "information",
};

export function NotificationsScreen({ showBack = true }: { showBack?: boolean }) {
  const t = useTheme();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const { data, isLoading, refetch } = useQuery({ queryKey: ["notifications"], queryFn: () => api.get("/notifications") });

  const readAll = useMutation({
    mutationFn: () => api.post("/notifications/read-all"),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["notifications"] }); refetch(); },
  });
  const readOne = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["notifications"] }); refetch(); },
  });

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.surface }}>
      <Header
        title="Notifications"
        onBack={showBack}
        right={
          (data?.unread ?? 0) > 0 ? (
            <Pressable testID="read-all" onPress={() => readAll.mutate()} hitSlop={8}>
              <Text style={{ color: t.colors.brandPrimary, fontWeight: "700" }}>Read all</Text>
            </Pressable>
          ) : null
        }
      />
      {isLoading ? (
        <Loading />
      ) : (data?.items?.length ?? 0) === 0 ? (
        <EmptyState icon="bell-outline" title="You're all caught up" subtitle="Important updates will appear here." />
      ) : (
        <FlatList
          data={data.items}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: insets.bottom + 100 }}
          refreshing={false}
          onRefresh={refetch}
          renderItem={({ item }) => (
            <Pressable
              testID={`notif-${item.id}`}
              onPress={() => !item.read && readOne.mutate(item.id)}
              style={{ flexDirection: "row", gap: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: item.read ? t.colors.surfaceSecondary : t.colors.brandTertiary, borderWidth: 1, borderColor: t.colors.border }}
            >
              <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: t.colors.surface, alignItems: "center", justifyContent: "center" }}>
                <Icon name={ICONS[item.type] || "information"} size={22} color={t.colors.brandPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "700", color: t.colors.onSurface }}>{item.title}</Text>
                <Text style={{ color: t.colors.onSurfaceTertiary, fontSize: fontSize.sm, marginTop: 2 }}>{item.body}</Text>
                <Text style={{ color: t.colors.muted, fontSize: 11, marginTop: 4 }}>{fromNow(item.created_at)}</Text>
              </View>
              {!item.read ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.colors.brandPrimary, marginTop: 6 }} /> : null}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
