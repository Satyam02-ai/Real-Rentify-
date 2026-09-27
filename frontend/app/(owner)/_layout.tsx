import { Stack, Redirect } from "expo-router";
import { useAuth } from "@/src/auth/AuthContext";

export default function OwnerLayout() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Redirect href="/(auth)/welcome" />;
  if (user.role !== "owner") return <Redirect href="/(tenant)/(tabs)/home" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
