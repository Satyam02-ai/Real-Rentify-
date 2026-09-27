import React from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Header } from "@/src/components/layout";
import { TicketsList } from "@/src/screens/TicketsList";
import { Icon } from "@/src/components/Icon";
import { useTheme, spacing } from "@/src/theme";

export default function TenantRequests() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: t.colors.surface }}>
      <Header title="My Requests" />
      <TicketsList role="tenant" detailBase="/(tenant)/ticket" />
      <Pressable
        testID="fab-create-ticket"
        onPress={() => router.push("/(tenant)/create-ticket")}
        style={{ position: "absolute", right: spacing.lg, bottom: insets.bottom + spacing.lg, width: 56, height: 56, borderRadius: 28, backgroundColor: t.colors.brandPrimary, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 5 }}
      >
        <Icon name="plus" size={28} color={t.colors.onBrandPrimary} />
      </Pressable>
    </View>
  );
}
