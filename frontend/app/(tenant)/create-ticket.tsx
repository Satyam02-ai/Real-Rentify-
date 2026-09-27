import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/src/api/client";
import { Header } from "@/src/components/layout";
import { AppButton, Loading, EmptyState } from "@/src/components/ui";
import { Field, useToast } from "@/src/components/forms";
import { useTheme, spacing, radius, fontSize } from "@/src/theme";

const CATEGORIES = ["Plumbing", "Electrical", "Appliance", "Carpentry", "Cleaning", "Other"];
const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

export default function CreateTicket() {
  const t = useTheme();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["tenant-dashboard"], queryFn: () => api.get("/tenant/dashboard") });
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState("Plumbing");
  const [priority, setPriority] = useState("medium");

  const create = useMutation({
    mutationFn: () => api.post("/tickets", {
      property_id: data.lease.property_id, unit_id: data.lease.unit_id,
      title, description: desc, category, priority,
    }),
    onSuccess: () => { toast("Request submitted", "success"); qc.invalidateQueries({ queryKey: ["tickets"] }); router.back(); },
    onError: (e: any) => toast(e.message, "error"),
  });

  if (isLoading) return <Loading />;

  if (!data?.lease) {
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.surface }}>
        <Header title="Raise Request" onBack />
        <EmptyState icon="home-alert" title="No active lease" subtitle="You need an active lease to raise maintenance requests." />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.surface }}>
      <Header title="Raise Request" onBack />
      <KeyboardAwareScrollView bottomOffset={20} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <Field testID="ticket-title" label="What's the issue?" value={title} onChangeText={setTitle} placeholder="Leaking kitchen tap" autoCapitalize="sentences" />
        <View>
          <Text style={{ color: t.colors.onSurfaceTertiary, fontSize: fontSize.sm, fontWeight: "600", marginBottom: spacing.sm }}>Category</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {CATEGORIES.map((c) => (
              <Text key={c} testID={`tcat-${c}`} onPress={() => setCategory(c)}
                style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, overflow: "hidden", backgroundColor: category === c ? t.colors.brandPrimary : t.colors.surfaceTertiary, color: category === c ? t.colors.onBrandPrimary : t.colors.onSurfaceTertiary, fontWeight: "600" }}>
                {c}
              </Text>
            ))}
          </View>
        </View>
        <View>
          <Text style={{ color: t.colors.onSurfaceTertiary, fontSize: fontSize.sm, fontWeight: "600", marginBottom: spacing.sm }}>Priority</Text>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            {PRIORITIES.map((p) => (
              <Pressable key={p.value} testID={`tprio-${p.value}`} onPress={() => setPriority(p.value)}
                style={{ flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: "center", backgroundColor: priority === p.value ? t.colors.brandPrimary : t.colors.surfaceTertiary }}>
                <Text style={{ color: priority === p.value ? t.colors.onBrandPrimary : t.colors.onSurfaceTertiary, fontWeight: "700" }}>{p.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <Field testID="ticket-desc" label="Details" value={desc} onChangeText={setDesc} placeholder="Describe the problem…" autoCapitalize="sentences" multiline />
        <AppButton testID="submit-ticket" title="Submit Request" loading={create.isPending} onPress={() => { if (!title) return toast("Add a title", "error"); create.mutate(); }} />
      </KeyboardAwareScrollView>
    </View>
  );
}
