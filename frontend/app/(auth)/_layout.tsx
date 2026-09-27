import { Stack, Redirect } from "expo-router";
import { useAuth } from "@/src/auth/AuthContext";

export default function AuthLayout() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) {
    return <Redirect href={user.role === "owner" ? "/(owner)/(tabs)/home" : "/(tenant)/(tabs)/home"} />;
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}
