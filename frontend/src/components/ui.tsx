import React from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  StyleProp,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Icon } from "./Icon";
import { makeStyles, useTheme, spacing, radius, fontSize } from "@/src/theme";

/* ---------------- Card ---------------- */
export function Card({
  children,
  style,
  padded = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  const s = useCardStyles();
  return <View style={[s.card, padded && s.padded, style]}>{children}</View>;
}
const useCardStyles = makeStyles((t) => ({
  card: {
    backgroundColor: t.colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  padded: { padding: spacing.lg },
}));

/* ---------------- AppButton ---------------- */
export function AppButton({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
  icon,
  style,
  testID,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const t = useTheme();
  const s = useButtonStyles();
  const isDisabled = disabled || loading;
  const bg =
    variant === "primary"
      ? t.colors.brandPrimary
      : variant === "danger"
      ? t.colors.error
      : variant === "secondary"
      ? t.colors.brandTertiary
      : "transparent";
  const fg =
    variant === "primary"
      ? t.colors.onBrandPrimary
      : variant === "danger"
      ? t.colors.onError
      : variant === "secondary"
      ? t.colors.onBrandTertiary
      : t.colors.brandPrimary;
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        if (isDisabled) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: bg, opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1 },
        variant === "ghost" && { paddingVertical: spacing.sm },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={s.row}>
          {icon ? <Icon name={icon} size={18} color={fg} style={{ marginRight: 8 }} /> : null}
          <Text style={[s.txt, { color: fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}
const useButtonStyles = makeStyles((t) => ({
  btn: {
    height: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  row: { flexDirection: "row", alignItems: "center" },
  txt: { fontSize: fontSize.lg, fontWeight: "700" },
}));

/* ---------------- StatusChip ---------------- */
const STATUS_MAP: Record<string, { label: string; tone: string }> = {
  due: { label: "Due", tone: "warning" },
  overdue: { label: "Overdue", tone: "error" },
  paid: { label: "Paid", tone: "success" },
  open: { label: "Open", tone: "warning" },
  in_progress: { label: "In Progress", tone: "info" },
  resolved: { label: "Resolved", tone: "success" },
  held: { label: "Held", tone: "info" },
  refunded: { label: "Refunded", tone: "success" },
  deducted: { label: "Deducted", tone: "warning" },
  low: { label: "Low", tone: "info" },
  medium: { label: "Medium", tone: "warning" },
  high: { label: "High", tone: "error" },
};
export function StatusChip({ status, testID }: { status: string; testID?: string }) {
  const t = useTheme();
  const cfg = STATUS_MAP[status] || { label: status, tone: "info" };
  const color = (t.colors as any)[cfg.tone] as string;
  return (
    <View
      testID={testID}
      style={{
        backgroundColor: color + "22",
        paddingHorizontal: spacing.md,
        paddingVertical: 4,
        borderRadius: radius.pill,
        alignSelf: "flex-start",
      }}
    >
      <Text style={{ color, fontSize: fontSize.sm, fontWeight: "700" }}>{cfg.label}</Text>
    </View>
  );
}

/* ---------------- EmptyState ---------------- */
export function EmptyState({
  icon = "inbox-outline",
  title,
  subtitle,
}: {
  icon?: string;
  title: string;
  subtitle?: string;
}) {
  const t = useTheme();
  return (
    <View style={{ alignItems: "center", padding: spacing["2xl"], gap: spacing.sm }}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: t.colors.brandTertiary,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={icon} size={34} color={t.colors.brandPrimary} />
      </View>
      <Text
        style={{
          color: t.colors.onSurface,
          fontSize: fontSize.lg,
          fontWeight: "700",
          marginTop: spacing.sm,
        }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text style={{ color: t.colors.muted, textAlign: "center", fontSize: fontSize.base }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

/* ---------------- Loading ---------------- */
export function Loading() {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing["2xl"] }}>
      <ActivityIndicator size="large" color={t.colors.brandPrimary} />
    </View>
  );
}

/* ---------------- SectionTitle ---------------- */
export function SectionTitle({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return (
    <Text
      style={[
        {
          color: t.colors.onSurface,
          fontSize: fontSize.xl,
          fontWeight: "800",
          marginBottom: spacing.md,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/* ---------------- SegmentedControl ---------------- */
export function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: t.colors.surfaceTertiary,
        borderRadius: radius.md,
        padding: 4,
      }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            testID={`segment-${o.value}`}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onChange(o.value);
            }}
            style={{
              flex: 1,
              paddingVertical: spacing.sm,
              borderRadius: radius.sm,
              backgroundColor: active ? t.colors.surfaceSecondary : "transparent",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: active ? t.colors.onSurface : t.colors.muted,
                fontWeight: active ? "700" : "500",
                fontSize: fontSize.base,
              }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
