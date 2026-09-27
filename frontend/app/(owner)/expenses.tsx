import React, { useState } from "react";
import { View, Text } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/src/api/client";
import { Header, ScreenScroll } from "@/src/components/layout";
import { Card, Loading, EmptyState, AppButton } from "@/src/components/ui";
import { Field, Sheet, useToast } from "@/src/components/forms";
import { Icon } from "@/src/components/Icon";
import { formatMoney, formatDate } from "@/src/utils/format";
import { useTheme, spacing, radius, fontSize } from "@/src/theme";

const CATEGORIES = ["Repairs", "Maintenance", "Utilities", "Cleaning", "Taxes", "Other"];

export default function Expenses() {
  const t = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery({ queryKey: ["expenses"], queryFn: () => api.get("/expenses") });
  const [sheet, setSheet] = useState(false);
  const [category, setCategory] = useState("Repairs");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [dt, setDt] = useState(new Date().toISOString().slice(0, 10));

  const add = useMutation({
    mutationFn: () => api.post("/expenses", { category, amount: Number(amount), note, date: dt }),
    onSuccess: () => { toast("Expense logged", "success"); setSheet(false); setAmount(""); setNote(""); refetch(); },
    onError: (e: any) => toast(e.message, "error"),
  });

  if (isLoading) return <Loading />;

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.surface }}>
      <Header title="Expenses" onBack right={<AppButton testID="add-expense" title="Add" icon="plus" variant="secondary" style={{ height: 40 }} onPress={() => setSheet(true)} />} />
      <ScreenScroll refreshing={false} onRefresh={refetch}>
        <View style={{ flexDirection: "row", gap: spacing.md, marginBottom: spacing.lg }}>
          <Card style={{ flex: 1 }}>
            <Text style={{ color: t.colors.muted, fontSize: fontSize.sm }}>This month</Text>
            <Text style={{ color: t.colors.error, fontSize: fontSize.xl, fontWeight: "900", marginTop: 2 }}>{formatMoney(data?.month_total)}</Text>
          </Card>
          <Card style={{ flex: 1 }}>
            <Text style={{ color: t.colors.muted, fontSize: fontSize.sm }}>All time</Text>
            <Text style={{ color: t.colors.onSurface, fontSize: fontSize.xl, fontWeight: "900", marginTop: 2 }}>{formatMoney(data?.total)}</Text>
          </Card>
        </View>

        {(data?.expenses?.length ?? 0) === 0 ? (
          <EmptyState icon="cash-remove" title="No expenses recorded" subtitle="Track repairs, utilities and more." />
        ) : (
          data.expenses.map((e: any) => (
            <Card key={e.id} style={{ marginBottom: spacing.sm }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: t.colors.surfaceTertiary, alignItems: "center", justifyContent: "center" }}>
                  <Icon name="tag-outline" size={20} color={t.colors.onSurfaceTertiary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "700", color: t.colors.onSurface }}>{e.category}</Text>
                  <Text style={{ fontSize: fontSize.sm, color: t.colors.muted }}>{e.note ? `${e.note} · ` : ""}{formatDate(e.date)}</Text>
                </View>
                <Text style={{ fontWeight: "900", color: t.colors.error }}>-{formatMoney(e.amount)}</Text>
              </View>
            </Card>
          ))
        )}
      </ScreenScroll>

      <Sheet visible={sheet} onClose={() => setSheet(false)} title="Log Expense">
        <View style={{ gap: spacing.lg }}>
          <View>
            <Text style={{ color: t.colors.onSurfaceTertiary, fontSize: fontSize.sm, fontWeight: "600", marginBottom: spacing.sm }}>Category</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {CATEGORIES.map((c) => (
                <Text
                  key={c}
                  testID={`cat-${c}`}
                  onPress={() => setCategory(c)}
                  style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, overflow: "hidden", backgroundColor: category === c ? t.colors.brandPrimary : t.colors.surfaceTertiary, color: category === c ? t.colors.onBrandPrimary : t.colors.onSurfaceTertiary, fontWeight: "600" }}
                >
                  {c}
                </Text>
              ))}
            </View>
          </View>
          <Field testID="exp-amount" label="Amount (₹)" value={amount} onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ""))} placeholder="1500" keyboardType="number-pad" />
          <Field testID="exp-note" label="Note (optional)" value={note} onChangeText={setNote} placeholder="Plumbing repair" autoCapitalize="sentences" />
          <Field testID="exp-date" label="Date" value={dt} onChangeText={setDt} placeholder="YYYY-MM-DD" />
          <AppButton testID="save-expense" title="Save Expense" loading={add.isPending} onPress={() => { if (!amount) return toast("Enter amount", "error"); add.mutate(); }} />
        </View>
      </Sheet>
    </View>
  );
}
