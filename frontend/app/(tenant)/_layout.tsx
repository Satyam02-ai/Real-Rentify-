import { Stack, Redirect } from "expo-router";
import { useAuth } from "@/src/auth/AuthContext";

export default function TenantLayout() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Redirect href="/(auth)/welcome" />;
  if (user.role !== "tenant") return <Redirect href="/(owner)/(tabs)/home" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
