import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Modal,
  Pressable,
  Animated,
  TextInputProps,
  KeyboardTypeOptions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "./Icon";
import { useTheme, spacing, radius, fontSize } from "@/src/theme";

/* ---------------- Field ---------------- */
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize = "none",
  maxLength,
  multiline,
  icon,
  testID,
  ...rest
}: {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: TextInputProps["autoCapitalize"];
  maxLength?: number;
  multiline?: boolean;
  icon?: string;
  testID?: string;
} & Partial<TextInputProps>) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!secureTextEntry);
  return (
    <View style={{ gap: spacing.xs }}>
      {label ? (
        <Text style={{ color: t.colors.onSurfaceTertiary, fontSize: fontSize.sm, fontWeight: "600" }}>
          {label}
        </Text>
      ) : null}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: t.colors.surfaceSecondary,
          borderRadius: radius.md,
          borderWidth: 1.5,
          borderColor: focused ? t.colors.brandPrimary : t.colors.border,
          paddingHorizontal: spacing.md,
          minHeight: 52,
        }}
      >
        {icon ? <Icon name={icon} size={20} color={t.colors.muted} style={{ marginRight: 8 }} /> : null}
        <TextInput
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={t.colors.muted}
          secureTextEntry={hidden}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          maxLength={maxLength}
          multiline={multiline}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex: 1,
            color: t.colors.onSurface,
            fontSize: fontSize.lg,
            paddingVertical: multiline ? spacing.md : spacing.sm,
            minHeight: multiline ? 96 : undefined,
            textAlignVertical: multiline ? "top" : "center",
          }}
          {...rest}
        />
        {secureTextEntry ? (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10}>
            <Icon name={hidden ? "eye-outline" : "eye-off-outline"} size={20} color={t.colors.muted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/* ---------------- Sheet (bottom sheet modal) ---------------- */
export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "#00000066" }} onPress={onClose} />
      <View
        style={{
          backgroundColor: t.colors.surface,
          borderTopLeftRadius: radius.lg,
          borderTopRightRadius: radius.lg,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: insets.bottom + spacing.lg,
          maxHeight: "88%",
        }}
      >
        <View
          style={{
            width: 40,
            height: 4,
            borderRadius: 2,
            backgroundColor: t.colors.borderStrong,
            alignSelf: "center",
            marginBottom: spacing.md,
          }}
        />
        {title ? (
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.lg }}>
            <Text style={{ color: t.colors.onSurface, fontSize: fontSize.xl, fontWeight: "800" }}>{title}</Text>
            <Pressable testID="sheet-close" onPress={onClose} hitSlop={10}>
              <Icon name="close" size={24} color={t.colors.muted} />
            </Pressable>
          </View>
        ) : null}
        {children}
      </View>
    </Modal>
  );
}

/* ---------------- Toast ---------------- */
type Toast = { id: number; message: string; tone: "success" | "error" | "info" };
const ToastCtx = createContext<(message: string, tone?: Toast["tone"]) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<Toast | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;

  const show = useCallback(
    (message: string, tone: Toast["tone"] = "info") => {
      setToast({ id: Date.now(), message, tone });
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() =>
          setToast(null)
        );
      }, 2600);
    },
    [opacity]
  );

  const toneColor =
    toast?.tone === "success" ? t.colors.success : toast?.tone === "error" ? t.colors.error : t.colors.surfaceInverse;

  return (
    <ToastCtx.Provider value={show}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: insets.top + spacing.md,
            left: spacing.lg,
            right: spacing.lg,
            opacity,
            backgroundColor: toneColor,
            borderRadius: radius.md,
            padding: spacing.md,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
          }}
        >
          <Icon
            name={toast.tone === "success" ? "check-circle" : toast.tone === "error" ? "alert-circle" : "information"}
            size={20}
            color={t.colors.onSuccess}
          />
          <Text style={{ color: t.colors.onSurfaceInverse, flex: 1, fontWeight: "600" }}>{toast.message}</Text>
        </Animated.View>
      ) : null}
    </ToastCtx.Provider>
  );
}
