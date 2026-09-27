import { View, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@/src/auth/AuthContext";
import { useTheme } from "@/src/theme";

export default function Index() {
  const { user, loading } = useAuth();
  const t = useTheme();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: t.colors.surface }}>
        <ActivityIndicator size="large" color={t.colors.brandPrimary} />
      </View>
    );
  }
  if (!user) return <Redirect href="/(auth)/welcome" />;
  if (user.role === "owner") return <Redirect href="/(owner)/(tabs)/home" />;
  return <Redirect href="/(tenant)/(tabs)/home" />;
}
