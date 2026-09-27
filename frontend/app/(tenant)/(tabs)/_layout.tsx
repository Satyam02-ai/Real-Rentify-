import React from "react";
import { Platform } from "react-native";
import { Tabs } from "expo-router";
import { Icon } from "@/src/components/Icon";
import { useTheme } from "@/src/theme";

export default function TenantTabs() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.colors.brandPrimary,
        tabBarInactiveTintColor: t.colors.muted,
        tabBarStyle: {
          backgroundColor: t.colors.surfaceSecondary,
          borderTopColor: t.colors.divider,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Home", tabBarIcon: ({ color, size }) => <Icon name="home-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="ledger" options={{ title: "Ledger", tabBarIcon: ({ color, size }) => <Icon name="book-open-variant" size={size} color={color} /> }} />
      <Tabs.Screen name="requests" options={{ title: "Requests", tabBarIcon: ({ color, size }) => <Icon name="wrench-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="alerts" options={{ title: "Alerts", tabBarIcon: ({ color, size }) => <Icon name="bell-outline" size={size} color={color} /> }} />
    </Tabs>
  );
}
