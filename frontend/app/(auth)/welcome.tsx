import { View, Text, useColorScheme } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppButton } from "@/src/components/ui";
import { Icon } from "@/src/components/Icon";
import { useTheme, spacing, fontSize } from "@/src/theme";

const HERO_LIGHT =
  "https://images.unsplash.com/photo-1615406020658-6c4b805f1f30?crop=entropy&cs=srgb&fm=jpg&q=85&w=1080";
const HERO_DARK =
  "https://images.unsplash.com/photo-1614595737476-42487331b8a1?crop=entropy&cs=srgb&fm=jpg&q=85&w=1080";

export default function Welcome() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.surface }}>
      <Image
        source={{ uri: scheme === "dark" ? HERO_DARK : HERO_LIGHT }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: "62%" }}
        contentFit="cover"
        transition={300}
      />
      <LinearGradient
        colors={["transparent", t.colors.surface]}
        style={{ position: "absolute", top: "30%", left: 0, right: 0, height: "40%" }}
      />
      <View style={{ flex: 1, justifyContent: "flex-end", padding: spacing.xl, paddingBottom: insets.bottom + spacing.xl }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm }}>
          <Icon name="home-city" size={30} color={t.colors.brandPrimary} />
          <Text style={{ fontSize: fontSize["2xl"], fontWeight: "900", color: t.colors.onSurface }}>Rentify</Text>
        </View>
        <Text style={{ fontSize: 34, fontWeight: "900", color: t.colors.onSurface, lineHeight: 40 }}>
          Rent, managed{"\n"}the smart way.
        </Text>
        <Text style={{ fontSize: fontSize.lg, color: t.colors.muted, marginTop: spacing.md, marginBottom: spacing.xl }}>
          Track revenue, collect rent, and manage tenants — all in one place.
        </Text>
        <AppButton testID="welcome-get-started" title="Get Started" icon="arrow-right" onPress={() => router.push("/(auth)/signup")} />
        <View style={{ height: spacing.md }} />
        <AppButton testID="welcome-login" title="I already have an account" variant="ghost" onPress={() => router.push("/(auth)/login")} />
      </View>
    </View>
  );
}
