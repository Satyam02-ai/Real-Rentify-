import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/src/api/client";
import { Card, Loading, EmptyState } from "@/src/components/ui";
import { Header } from "@/src/components/layout";
import { Icon } from "@/src/components/Icon";
import { useTheme, spacing, radius, fontSize } from "@/src/theme";
import { FlatList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function Properties() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, isLoading, refetch } = useQuery({ queryKey: ["properties"], queryFn: () => api.get("/properties") });

  useFocusEffect(React.useCallback(() => { refetch(); }, [refetch]));

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.surface }}>
      <Header title="Properties" subtitle={`${data?.length ?? 0} propert${(data?.length ?? 0) === 1 ? "y" : "ies"}`} />
      {isLoading ? (
        <Loading />
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState icon="office-building-outline" title="No properties yet" subtitle="Tap the + button to add your first property." />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 120 }}
          renderItem={({ item }) => (
            <Pressable testID={`property-${item.id}`} onPress={() => router.push(`/(owner)/property/${item.id}`)}>
              <Card>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                  <View style={{ width: 48, height: 48, borderRadius: radius.md, backgroundColor: t.colors.brandTertiary, alignItems: "center", justifyContent: "center" }}>
                    <Icon name="office-building" size={24} color={t.colors.brandPrimary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: fontSize.lg, fontWeight: "700", color: t.colors.onSurface }}>{item.name}</Text>
                    <Text style={{ fontSize: fontSize.sm, color: t.colors.muted }} numberOfLines={1}>{item.address}{item.city ? `, ${item.city}` : ""}</Text>
                  </View>
                  <Icon name="chevron-right" size={22} color={t.colors.muted} />
                </View>
                <View style={{ flexDirection: "row", gap: spacing.lg, marginTop: spacing.md }}>
                  <Text style={{ fontSize: fontSize.sm, color: t.colors.muted }}>
                    <Text style={{ fontWeight: "800", color: t.colors.onSurface }}>{item.unit_count}</Text> units
                  </Text>
                  <Text style={{ fontSize: fontSize.sm, color: t.colors.success }}>
                    <Text style={{ fontWeight: "800" }}>{item.occupied}</Text> occupied
                  </Text>
                  <Text style={{ fontSize: fontSize.sm, color: t.colors.info }}>
                    <Text style={{ fontWeight: "800" }}>{item.unit_count - item.occupied}</Text> vacant
                  </Text>
                </View>
              </Card>
            </Pressable>
          )}
        />
      )}
      <Pressable
        testID="fab-add-property"
        onPress={() => router.push("/(owner)/add-property")}
        style={{ position: "absolute", right: spacing.lg, bottom: insets.bottom + spacing.lg, width: 56, height: 56, borderRadius: 28, backgroundColor: t.colors.brandPrimary, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 5 }}
      >
        <Icon name="plus" size={28} color={t.colors.onBrandPrimary} />
      </Pressable>
    </View>
  );
}
