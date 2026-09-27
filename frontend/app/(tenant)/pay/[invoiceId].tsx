import React, { useState, useRef } from "react";
import { View, Text, ActivityIndicator, Platform } from "react-native";
import { WebView } from "react-native-webview";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import { Header } from "@/src/components/layout";
import { AppButton, Loading } from "@/src/components/ui";
import { useToast } from "@/src/components/forms";
import { Icon } from "@/src/components/Icon";
import { useTheme, spacing, fontSize } from "@/src/theme";

function buildHtml(order: any, brandColor: string) {
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><script src="https://checkout.razorpay.com/v1/checkout.js"></script></head>
<body style="margin:0;background:#FDFBF7;font-family:-apple-system,Roboto,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
<div style="text-align:center"><p style="color:#76736E">Opening secure payment…</p></div>
<script>
function post(o){ if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(JSON.stringify(o));} }
var opts={ key:"${order.key_id}", amount:${order.amount}, currency:"${order.currency}", name:"${order.name}", description:"${order.description}", order_id:"${order.order_id}", prefill:{email:"${order.prefill.email}",contact:"${order.prefill.contact}"}, theme:{color:"${brandColor}"},
handler:function(r){ post({type:"success",payload:r}); },
modal:{ondismiss:function(){ post({type:"dismiss"}); }} };
var rzp=new Razorpay(opts); rzp.on('payment.failed',function(r){ post({type:"failed",payload:r.error}); }); rzp.open();
</script></body></html>`;
}

export default function Pay() {
  const t = useTheme();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { invoiceId } = useLocalSearchParams<{ invoiceId: string }>();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const started = useRef(false);

  async function startPayment() {
    if (started.current) return;
    started.current = true;
    setLoading(true);
    try {
      const o = await api.post("/rent/orders", { invoice_id: invoiceId });
      setOrder(o);
    } catch (e: any) {
      toast(e.message || "Could not start payment", "error");
      router.back();
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => { startPayment(); }, []);

  async function onMessage(event: any) {
    let msg: any = {};
    try { msg = JSON.parse(event.nativeEvent.data); } catch { return; }
    if (msg.type === "success") {
      setProcessing(true);
      try {
        await api.post("/payments/verify", {
          razorpay_payment_id: msg.payload.razorpay_payment_id,
          razorpay_order_id: msg.payload.razorpay_order_id,
          razorpay_signature: msg.payload.razorpay_signature,
        });
        qc.invalidateQueries({ queryKey: ["tenant-dashboard"] });
        qc.invalidateQueries({ queryKey: ["ledger"] });
        toast("Payment successful 🎉", "success");
        router.back();
      } catch (e: any) {
        toast("Payment verification failed", "error");
        router.back();
      }
    } else if (msg.type === "dismiss") {
      router.back();
    } else if (msg.type === "failed") {
      toast(msg.payload?.description || "Payment failed", "error");
      router.back();
    }
  }

  if (loading || !order) {
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.surface }}>
        <Header title="Pay Rent" onBack />
        <Loading />
      </View>
    );
  }

  if (processing) {
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.surface, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={t.colors.brandPrimary} />
        <Text style={{ marginTop: spacing.md, color: t.colors.muted }}>Confirming payment…</Text>
      </View>
    );
  }

  // Web preview cannot host the native Razorpay WebView flow reliably
  if (Platform.OS === "web") {
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.surface }}>
        <Header title="Pay Rent" onBack />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl }}>
          <Icon name="cellphone-check" size={56} color={t.colors.brandPrimary} />
          <Text style={{ fontSize: fontSize.lg, fontWeight: "800", color: t.colors.onSurface, marginTop: spacing.lg, textAlign: "center" }}>
            Open Rentify on your phone to pay
          </Text>
          <Text style={{ color: t.colors.muted, textAlign: "center", marginTop: spacing.sm }}>
            Secure UPI/card checkout runs in the mobile app.
          </Text>
          <View style={{ height: spacing.xl }} />
          <AppButton testID="pay-back" title="Go Back" variant="secondary" onPress={() => router.back()} style={{ alignSelf: "stretch" }} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.surface }}>
      <Header title="Pay Rent" onBack />
      <WebView
        testID="razorpay-webview"
        originWhitelist={["*"]}
        source={{ html: buildHtml(order, t.colors.brandPrimary) }}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
      />
    </View>
  );
}
