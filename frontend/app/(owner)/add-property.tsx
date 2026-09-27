import { useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/src/api/client";
import { Header } from "@/src/components/layout";
import { AppButton } from "@/src/components/ui";
import { Field, useToast } from "@/src/components/forms";
import { useTheme, spacing } from "@/src/theme";

export default function AddProperty() {
  const t = useTheme();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);

  async function save() {
    if (!name || !address) return toast("Enter name and address", "error");
    setLoading(true);
    try {
      const p = await api.post("/properties", { name, address, city });
      qc.invalidateQueries({ queryKey: ["properties"] });
      qc.invalidateQueries({ queryKey: ["owner-dashboard"] });
      toast("Property added", "success");
      router.replace(`/(owner)/property/${p.id}`);
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.surface }}>
      <Header title="Add Property" onBack />
      <KeyboardAwareScrollView bottomOffset={20} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <Field testID="prop-name" label="Property name" value={name} onChangeText={setName} placeholder="Sunrise Apartments" autoCapitalize="words" icon="office-building-outline" />
        <Field testID="prop-address" label="Address" value={address} onChangeText={setAddress} placeholder="MG Road, Sector 5" autoCapitalize="words" icon="map-marker-outline" />
        <Field testID="prop-city" label="City" value={city} onChangeText={setCity} placeholder="Pune" autoCapitalize="words" icon="city-variant-outline" />
        <AppButton testID="save-property" title="Save Property" loading={loading} onPress={save} />
      </KeyboardAwareScrollView>
    </View>
  );
}
