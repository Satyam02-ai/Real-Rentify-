import React from "react";
import { View, Text, Pressable, ScrollView, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Icon } from "./Icon";
import { useTheme, spacing, fontSize } from "@/src/theme";

export function Header({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: boolean;
  right?: React.ReactNode;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View
      style={{
        paddingTop: insets.top + spacing.sm,
        paddingBottom: spacing.md,
        paddingHorizontal: spacing.lg,
        backgroundColor: t.colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: t.colors.divider,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
      }}
    >
      {onBack ? (
        <Pressable testID="header-back" onPress={() => router.back()} hitSlop={12}>
          <Icon name="arrow-left" size={26} color={t.colors.onSurface} />
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: fontSize.xl, fontWeight: "800", color: t.colors.onSurface }}>{title}</Text>
        {subtitle ? <Text style={{ fontSize: fontSize.sm, color: t.colors.muted }}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function ScreenScroll({
  children,
  refreshing,
  onRefresh,
  contentStyle,
}: {
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: any;
}) {
  const t = useTheme();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.colors.surface }}
      contentContainerStyle={[{ padding: spacing.lg, paddingBottom: spacing["3xl"] }, contentStyle]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={t.colors.brandPrimary} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}
