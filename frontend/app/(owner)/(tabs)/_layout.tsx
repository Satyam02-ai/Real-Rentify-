import React from "react";
import { Platform } from "react-native";
import { Tabs } from "expo-router";
import { Icon } from "@/src/components/Icon";
import { useTheme } from "@/src/theme";

export default function OwnerTabs() {
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
      <Tabs.Screen
        name="home"
        options={{ title: "Home", tabBarIcon: ({ color, size }) => <Icon name="view-dashboard-outline" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="properties"
        options={{ title: "Properties", tabBarIcon: ({ color, size }) => <Icon name="office-building-outline" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="finances"
        options={{ title: "Finances", tabBarIcon: ({ color, size }) => <Icon name="cash-multiple" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="more"
        options={{ title: "More", tabBarIcon: ({ color, size }) => <Icon name="menu" size={size} color={color} /> }}
      />
    </Tabs>
  );
}
