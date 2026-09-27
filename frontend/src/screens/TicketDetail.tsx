import React, { useState } from "react";
import { View, Text } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/src/api/client";
import { Header } from "@/src/components/layout";
import { Card, Loading, StatusChip, AppButton, SegmentedControl } from "@/src/components/ui";
import { Field, useToast } from "@/src/components/forms";
import { Icon } from "@/src/components/Icon";
import { fromNow } from "@/src/utils/format";
import { useTheme, spacing, radius, fontSize } from "@/src/theme";

export function TicketDetail({ role }: { role: "owner" | "tenant" }) {
  const t = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, refetch } = useQuery({ queryKey: ["ticket", id], queryFn: () => api.get(`/tickets/${id}`) });
  const [comment, setComment] = useState("");

  const update = useMutation({
    mutationFn: (body: any) => api.patch(`/tickets/${id}`, body),
    onSuccess: () => { toast("Updated", "success"); setComment(""); refetch(); qc.invalidateQueries({ queryKey: ["tickets"] }); },
    onError: (e: any) => toast(e.message, "error"),
  });

  if (isLoading || !data) return <Loading />;

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.surface }}>
      <Header title={data.ticket_no} subtitle={data.property_name} onBack />
      <KeyboardAwareScrollView bottomOffset={20} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        <Card>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <Text style={{ fontSize: fontSize.xl, fontWeight: "800", color: t.colors.onSurface, flex: 1 }}>{data.title}</Text>
            <StatusChip status={data.priority} />
          </View>
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
            <StatusChip status={data.status} />
            <View style={{ backgroundColor: t.colors.surfaceTertiary, paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill }}>
              <Text style={{ color: t.colors.onSurfaceTertiary, fontSize: fontSize.sm, fontWeight: "600" }}>{data.category}</Text>
            </View>
          </View>
          {data.description ? <Text style={{ color: t.colors.onSurfaceTertiary, marginTop: spacing.md, fontSize: fontSize.base, lineHeight: 21 }}>{data.description}</Text> : null}
          <Text style={{ color: t.colors.muted, fontSize: fontSize.sm, marginTop: spacing.md }}>Raised by {data.raised_by} · {fromNow(data.created_at)}</Text>
        </Card>

        {role === "owner" ? (
          <Card>
            <Text style={{ fontWeight: "700", color: t.colors.onSurface, marginBottom: spacing.sm }}>Update status</Text>
            <SegmentedControl
              value={data.status}
              onChange={(v) => update.mutate({ status: v })}
              options={[
                { label: "Open", value: "open" },
                { label: "In Progress", value: "in_progress" },
                { label: "Resolved", value: "resolved" },
              ]}
            />
          </Card>
        ) : null}

        <Card>
          <Text style={{ fontWeight: "700", color: t.colors.onSurface, marginBottom: spacing.md }}>Activity ({data.comments?.length ?? 0})</Text>
          {(data.comments || []).length === 0 ? (
            <Text style={{ color: t.colors.muted, fontSize: fontSize.sm }}>No comments yet.</Text>
          ) : (
            data.comments.map((c: any, i: number) => (
              <View key={i} style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.role === "owner" ? t.colors.brandPrimary : t.colors.surfaceTertiary, alignItems: "center", justifyContent: "center" }}>
                  <Icon name={c.role === "owner" ? "shield-account" : "account"} size={16} color={c.role === "owner" ? t.colors.onBrandPrimary : t.colors.onSurfaceTertiary} />
                </View>
                <View style={{ flex: 1, backgroundColor: t.colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md }}>
                  <Text style={{ fontWeight: "700", color: t.colors.onSurface, fontSize: fontSize.sm }}>{c.by}</Text>
                  <Text style={{ color: t.colors.onSurfaceTertiary, marginTop: 2 }}>{c.text}</Text>
                  <Text style={{ color: t.colors.muted, fontSize: 11, marginTop: 4 }}>{fromNow(c.at)}</Text>
                </View>
              </View>
            ))
          )}
          <Field testID="ticket-comment" value={comment} onChangeText={setComment} placeholder="Add a comment…" autoCapitalize="sentences" multiline />
          <View style={{ height: spacing.sm }} />
          <AppButton testID="send-comment" title="Send" icon="send" style={{ height: 44 }} loading={update.isPending} onPress={() => { if (!comment.trim()) return; update.mutate({ comment }); }} />
        </Card>
      </KeyboardAwareScrollView>
    </View>
  );
}
