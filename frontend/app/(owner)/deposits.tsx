import React, { useState } from "react";
import { View, Text } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/src/api/client";
import { Header, ScreenScroll } from "@/src/components/layout";
import { Card, Loading, EmptyState, AppButton, StatusChip } from "@/src/components/ui";
import { Field, Sheet, useToast } from "@/src/components/forms";
import { formatMoney, formatDate } from "@/src/utils/format";
import { useTheme, spacing, fontSize } from "@/src/theme";

export default function Deposits() {
  const t = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery({ queryKey: ["deposits"], queryFn: () => api.get("/deposits") });
  const [dedSheet, setDedSheet] = useState<string | null>(null);
  const [refSheet, setRefSheet] = useState<any>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [refDate, setRefDate] = useState(new Date().toISOString().slice(0, 10));

  const deduct = useMutation({
    mutationFn: (id: string) => api.post(`/deposits/${id}/deduction`, { amount: Number(amount), reason }),
    onSuccess: () => { toast("Deduction recorded", "success"); setDedSheet(null); setAmount(""); setReason(""); refetch(); },
    onError: (e: any) => toast(e.message, "error"),
  });
  const refund = useMutation({
    mutationFn: (dep: any) => api.post(`/deposits/${dep.id}/refund`, { amount: Number(amount), refund_date: refDate }),
    onSuccess: () => { toast("Refund recorded", "success"); setRefSheet(null); setAmount(""); refetch(); },
    onError: (e: any) => toast(e.message, "error"),
  });

  if (isLoading) return <Loading />;

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.surface }}>
      <Header title="Security Deposits" onBack />
      <ScreenScroll refreshing={false} onRefresh={refetch}>
        {(data?.length ?? 0) === 0 ? (
          <EmptyState icon="shield-account-outline" title="No deposits yet" subtitle="Deposits appear when you assign tenants with a security deposit." />
        ) : (
          data.map((d: any) => {
            const remaining = d.amount - (d.deducted_total || 0);
            return (
              <Card key={d.id} style={{ marginBottom: spacing.md }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontSize: fontSize.lg, fontWeight: "700", color: t.colors.onSurface }}>{d.tenant_name}</Text>
                  <StatusChip status={d.status} />
                </View>
                <View style={{ flexDirection: "row", gap: spacing.xl, marginTop: spacing.md }}>
                  <View><Text style={{ color: t.colors.muted, fontSize: fontSize.sm }}>Deposit</Text><Text style={{ fontWeight: "900", color: t.colors.onSurface }}>{formatMoney(d.amount)}</Text></View>
                  <View><Text style={{ color: t.colors.muted, fontSize: fontSize.sm }}>Deducted</Text><Text style={{ fontWeight: "900", color: t.colors.warning }}>{formatMoney(d.deducted_total)}</Text></View>
                  <View><Text style={{ color: t.colors.muted, fontSize: fontSize.sm }}>Refundable</Text><Text style={{ fontWeight: "900", color: t.colors.success }}>{formatMoney(remaining)}</Text></View>
                </View>
                {(d.deductions || []).map((ded: any, i: number) => (
                  <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: t.colors.divider }}>
                    <Text style={{ color: t.colors.onSurfaceTertiary, fontSize: fontSize.sm, flex: 1 }}>{ded.reason} · {formatDate(ded.date)}</Text>
                    <Text style={{ color: t.colors.warning, fontWeight: "700", fontSize: fontSize.sm }}>-{formatMoney(ded.amount)}</Text>
                  </View>
                ))}
                {d.refund_date ? (
                  <Text style={{ color: t.colors.success, fontSize: fontSize.sm, marginTop: spacing.sm }}>Refunded {formatMoney(d.refund_amount)} on {formatDate(d.refund_date)}</Text>
                ) : (
                  <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
                    <AppButton testID={`deduct-${d.id}`} title="Deduct" variant="secondary" style={{ flex: 1, height: 44 }} onPress={() => { setAmount(""); setDedSheet(d.id); }} />
                    <AppButton testID={`refund-${d.id}`} title="Refund" style={{ flex: 1, height: 44 }} onPress={() => { setAmount(String(remaining)); setRefSheet(d); }} />
                  </View>
                )}
              </Card>
            );
          })
        )}
      </ScreenScroll>

      <Sheet visible={!!dedSheet} onClose={() => setDedSheet(null)} title="Record Deduction">
        <View style={{ gap: spacing.lg }}>
          <Field testID="ded-amount" label="Deduction amount (₹)" value={amount} onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ""))} placeholder="2000" keyboardType="number-pad" />
          <Field testID="ded-reason" label="Reason" value={reason} onChangeText={setReason} placeholder="Wall damage repair" autoCapitalize="sentences" />
          <AppButton testID="save-deduction" title="Record Deduction" loading={deduct.isPending} onPress={() => { if (!amount || !reason) return toast("Fill all fields", "error"); deduct.mutate(dedSheet!); }} />
        </View>
      </Sheet>

      <Sheet visible={!!refSheet} onClose={() => setRefSheet(null)} title="Refund Deposit">
        <View style={{ gap: spacing.lg }}>
          <Field testID="ref-amount" label="Refund amount (₹)" value={amount} onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ""))} placeholder="18000" keyboardType="number-pad" />
          <Field testID="ref-date" label="Refund date" value={refDate} onChangeText={setRefDate} placeholder="YYYY-MM-DD" />
          <AppButton testID="save-refund" title="Confirm Refund" loading={refund.isPending} onPress={() => refund.mutate(refSheet)} />
        </View>
      </Sheet>
    </View>
  );
}
