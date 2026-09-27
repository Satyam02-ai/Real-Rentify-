import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/src/api/client";
import { Header, ScreenScroll } from "@/src/components/layout";
import { Card, Loading, EmptyState, AppButton, StatusChip } from "@/src/components/ui";
import { Field, Sheet, useToast } from "@/src/components/forms";
import { Icon } from "@/src/components/Icon";
import { formatMoney } from "@/src/utils/format";
import { useTheme, spacing, radius, fontSize } from "@/src/theme";

export default function PropertyDetail() {
  const t = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, refetch } = useQuery({ queryKey: ["property", id], queryFn: () => api.get(`/properties/${id}`) });

  const [unitSheet, setUnitSheet] = useState(false);
  const [leaseSheet, setLeaseSheet] = useState<string | null>(null);
  const [uName, setUName] = useState("");
  const [uRent, setURent] = useState("");
  // lease form
  const [tenantEmail, setTenantEmail] = useState("");
  const [lRent, setLRent] = useState("");
  const [lDeposit, setLDeposit] = useState("");
  const [lStart, setLStart] = useState(new Date().toISOString().slice(0, 10));
  const [lEnd, setLEnd] = useState(new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10));

  const addUnit = useMutation({
    mutationFn: () => api.post(`/properties/${id}/units`, { name: uName, rent_amount: Number(uRent) }),
    onSuccess: () => { toast("Unit added", "success"); setUnitSheet(false); setUName(""); setURent(""); refetch(); qc.invalidateQueries({ queryKey: ["owner-dashboard"] }); },
    onError: (e: any) => toast(e.message, "error"),
  });

  const addLease = useMutation({
    mutationFn: (unitId: string) => api.post(`/leases`, {
      unit_id: unitId, tenant_email: tenantEmail, rent_amount: Number(lRent),
      security_deposit: Number(lDeposit || 0), start_date: lStart, end_date: lEnd, rent_due_day: 1,
    }),
    onSuccess: () => { toast("Tenant assigned", "success"); setLeaseSheet(null); setTenantEmail(""); setLRent(""); setLDeposit(""); refetch(); qc.invalidateQueries({ queryKey: ["owner-dashboard"] }); qc.invalidateQueries({ queryKey: ["invoices"] }); },
    onError: (e: any) => toast(e.message, "error"),
  });

  if (isLoading) return <Loading />;

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.surface }}>
      <Header title={data?.name || "Property"} subtitle={data?.address} onBack />
      <ScreenScroll refreshing={false} onRefresh={refetch}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md }}>
          <Text style={{ fontSize: fontSize.xl, fontWeight: "800", color: t.colors.onSurface }}>Units ({data?.units?.length ?? 0})</Text>
          <AppButton testID="add-unit-btn" title="Add Unit" icon="plus" variant="secondary" style={{ height: 40 }} onPress={() => setUnitSheet(true)} />
        </View>

        {(data?.units?.length ?? 0) === 0 ? (
          <EmptyState icon="door" title="No units yet" subtitle="Add units (flats/rooms) to this property." />
        ) : (
          data.units.map((u: any) => (
            <Card key={u.id} style={{ marginBottom: spacing.md }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: t.colors.surfaceTertiary, alignItems: "center", justifyContent: "center" }}>
                  <Icon name="door-closed" size={22} color={t.colors.onSurfaceTertiary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: fontSize.lg, fontWeight: "700", color: t.colors.onSurface }}>{u.name}</Text>
                  <Text style={{ fontSize: fontSize.sm, color: t.colors.muted }}>{formatMoney(u.rent_amount)}/mo</Text>
                </View>
                <StatusChip status={u.status === "occupied" ? "paid" : "due"} />
              </View>
              {u.status === "vacant" ? (
                <AppButton testID={`assign-${u.id}`} title="Assign Tenant" icon="account-plus-outline" variant="secondary" style={{ height: 44, marginTop: spacing.md }} onPress={() => { setLRent(String(u.rent_amount)); setLeaseSheet(u.id); }} />
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.md }}>
                  <Icon name="account-check" size={16} color={t.colors.success} />
                  <Text style={{ color: t.colors.success, fontSize: fontSize.sm, fontWeight: "600" }}>Occupied</Text>
                </View>
              )}
            </Card>
          ))
        )}
      </ScreenScroll>

      {/* Add unit sheet */}
      <Sheet visible={unitSheet} onClose={() => setUnitSheet(false)} title="Add Unit">
        <View style={{ gap: spacing.lg }}>
          <Field testID="unit-name" label="Unit name / number" value={uName} onChangeText={setUName} placeholder="Flat 101" autoCapitalize="characters" />
          <Field testID="unit-rent" label="Monthly rent (₹)" value={uRent} onChangeText={(v) => setURent(v.replace(/[^0-9]/g, ""))} placeholder="8500" keyboardType="number-pad" />
          <AppButton testID="save-unit" title="Add Unit" loading={addUnit.isPending} onPress={() => { if (!uName || !uRent) return toast("Fill all fields", "error"); addUnit.mutate(); }} />
        </View>
      </Sheet>

      {/* Assign tenant sheet */}
      <Sheet visible={!!leaseSheet} onClose={() => setLeaseSheet(null)} title="Assign Tenant">
        <KeyboardAwareScrollView bottomOffset={20} contentContainerStyle={{ gap: spacing.lg }}>
          <Text style={{ color: t.colors.muted, fontSize: fontSize.sm }}>Tenant must have a Rentify account. Enter their signup email.</Text>
          <Field testID="lease-email" label="Tenant email" value={tenantEmail} onChangeText={setTenantEmail} placeholder="tenant@example.com" keyboardType="email-address" icon="email-outline" />
          <Field testID="lease-rent" label="Monthly rent (₹)" value={lRent} onChangeText={(v) => setLRent(v.replace(/[^0-9]/g, ""))} placeholder="8500" keyboardType="number-pad" />
          <Field testID="lease-deposit" label="Security deposit (₹)" value={lDeposit} onChangeText={(v) => setLDeposit(v.replace(/[^0-9]/g, ""))} placeholder="20000" keyboardType="number-pad" />
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <View style={{ flex: 1 }}><Field testID="lease-start" label="Start date" value={lStart} onChangeText={setLStart} placeholder="YYYY-MM-DD" /></View>
            <View style={{ flex: 1 }}><Field testID="lease-end" label="End date" value={lEnd} onChangeText={setLEnd} placeholder="YYYY-MM-DD" /></View>
          </View>
          <AppButton testID="save-lease" title="Assign Tenant" loading={addLease.isPending} onPress={() => { if (!tenantEmail || !lRent) return toast("Fill required fields", "error"); addLease.mutate(leaseSheet!); }} />
        </KeyboardAwareScrollView>
      </Sheet>
    </View>
  );
}
