import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/src/api/client";
import { Card, Loading, EmptyState, StatusChip, SegmentedControl, AppButton } from "@/src/components/ui";
import { Header, ScreenScroll } from "@/src/components/layout";
import { Icon } from "@/src/components/Icon";
import { useToast } from "@/src/components/forms";
import { formatMoney, formatMoneyShort, formatDate } from "@/src/utils/format";
import { useTheme, spacing, radius, fontSize } from "@/src/theme";

function Bars({ trend }: { trend: { month: string; value: number }[] }) {
  const t = useTheme();
  const max = Math.max(1, ...trend.map((x) => x.value));
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 120, gap: spacing.sm }}>
      {trend.map((x, i) => (
        <View key={i} style={{ flex: 1, alignItems: "center", gap: spacing.xs }}>
          <View style={{ width: "70%", height: Math.max(6, (x.value / max) * 92), backgroundColor: x.value > 0 ? t.colors.brandPrimary : t.colors.surfaceTertiary, borderRadius: radius.sm }} />
          <Text style={{ fontSize: 10, color: t.colors.muted }}>{x.month}</Text>
        </View>
      ))}
    </View>
  );
}

export default function Finances() {
  const t = useTheme();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState("invoices");
  const dash = useQuery({ queryKey: ["owner-dashboard"], queryFn: () => api.get("/owner/dashboard") });
  const trend = useQuery({ queryKey: ["revenue-trend"], queryFn: () => api.get("/owner/revenue-trend") });
  const invoices = useQuery({ queryKey: ["invoices"], queryFn: () => api.get("/invoices") });
  const expenses = useQuery({ queryKey: ["expenses"], queryFn: () => api.get("/expenses") });

  useFocusEffect(React.useCallback(() => { dash.refetch(); invoices.refetch(); expenses.refetch(); trend.refetch(); }, []));

  const markPaid = useMutation({
    mutationFn: (id: string) => api.post(`/invoices/${id}/mark-paid`),
    onSuccess: () => { toast("Marked as paid", "success"); qc.invalidateQueries({ queryKey: ["invoices"] }); qc.invalidateQueries({ queryKey: ["owner-dashboard"] }); qc.invalidateQueries({ queryKey: ["revenue-trend"] }); },
    onError: (e: any) => toast(e.message, "error"),
  });
  const remind = useMutation({
    mutationFn: (id: string) => api.post(`/invoices/${id}/send-reminder`),
    onSuccess: (r: any) => toast(r.whatsapp_sent ? "WhatsApp reminder sent" : "In-app reminder sent", "success"),
    onError: (e: any) => toast(e.message, "error"),
  });

  if (dash.isLoading) return <Loading />;

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.surface }}>
      <Header title="Finances" />
      <ScreenScroll>
        <Card style={{ marginBottom: spacing.md }}>
          <Text style={{ color: t.colors.muted, fontSize: fontSize.sm, fontWeight: "600" }}>Revenue trend (6 months)</Text>
          <Text style={{ color: t.colors.onSurface, fontSize: fontSize["2xl"], fontWeight: "900", marginVertical: spacing.sm }}>
            {formatMoney(dash.data?.revenue_month)} <Text style={{ fontSize: fontSize.sm, color: t.colors.muted }}>this month</Text>
          </Text>
          {trend.data ? <Bars trend={trend.data} /> : null}
        </Card>

        <View style={{ flexDirection: "row", gap: spacing.md, marginBottom: spacing.lg }}>
          <Card style={{ flex: 1 }}>
            <Text style={{ color: t.colors.muted, fontSize: fontSize.sm }}>Pending Rent</Text>
            <Text style={{ color: t.colors.warning, fontSize: fontSize.xl, fontWeight: "900", marginTop: 2 }}>{formatMoneyShort(dash.data?.pending_rent)}</Text>
          </Card>
          <Card style={{ flex: 1 }}>
            <Text style={{ color: t.colors.muted, fontSize: fontSize.sm }}>Expenses (mo)</Text>
            <Text style={{ color: t.colors.error, fontSize: fontSize.xl, fontWeight: "900", marginTop: 2 }}>{formatMoneyShort(expenses.data?.month_total)}</Text>
          </Card>
        </View>

        <SegmentedControl options={[{ label: "Rent Invoices", value: "invoices" }, { label: "Expenses", value: "expenses" }]} value={tab} onChange={setTab} />
        <View style={{ height: spacing.md }} />

        {tab === "invoices" ? (
          (invoices.data?.length ?? 0) === 0 ? (
            <EmptyState icon="file-document-outline" title="No invoices yet" subtitle="Rent invoices appear once you assign tenants to units." />
          ) : (
            invoices.data.map((inv: any) => (
              <Card key={inv.id} style={{ marginBottom: spacing.md }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: fontSize.lg, fontWeight: "700", color: t.colors.onSurface }}>{inv.label}</Text>
                    <Text style={{ fontSize: fontSize.sm, color: t.colors.muted }}>{inv.tenant_name} · due {formatDate(inv.due_date)}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: spacing.xs }}>
                    <Text style={{ fontSize: fontSize.lg, fontWeight: "900", color: t.colors.onSurface }}>{formatMoney(inv.amount)}</Text>
                    <StatusChip status={inv.status} />
                  </View>
                </View>
                {inv.status !== "paid" ? (
                  <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
                    <AppButton testID={`remind-${inv.id}`} title="Send Reminder" icon="whatsapp" variant="secondary" style={{ flex: 1, height: 44 }} onPress={() => remind.mutate(inv.id)} />
                    <AppButton testID={`markpaid-${inv.id}`} title="Mark Paid" variant="primary" style={{ flex: 1, height: 44 }} loading={markPaid.isPending} onPress={() => markPaid.mutate(inv.id)} />
                  </View>
                ) : null}
              </Card>
            ))
          )
        ) : (
          <>
            <AppButton testID="log-expense" title="Log Expense" icon="plus" variant="secondary" onPress={() => router.push("/(owner)/expenses")} />
            <View style={{ height: spacing.md }} />
            {(expenses.data?.expenses?.length ?? 0) === 0 ? (
              <EmptyState icon="cash-remove" title="No expenses recorded" subtitle="Track maintenance, repairs and other costs." />
            ) : (
              expenses.data.expenses.map((e: any) => (
                <Card key={e.id} style={{ marginBottom: spacing.sm, flexDirection: "row" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", flex: 1, gap: spacing.md }}>
                    <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: t.colors.surfaceTertiary, alignItems: "center", justifyContent: "center" }}>
                      <Icon name="tag-outline" size={20} color={t.colors.onSurfaceTertiary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: "700", color: t.colors.onSurface }}>{e.category}</Text>
                      <Text style={{ fontSize: fontSize.sm, color: t.colors.muted }}>{e.note || formatDate(e.date)}</Text>
                    </View>
                    <Text style={{ fontWeight: "900", color: t.colors.error }}>-{formatMoney(e.amount)}</Text>
                  </View>
                </Card>
              ))
            )}
          </>
        )}
      </ScreenScroll>
    </View>
  );
}
