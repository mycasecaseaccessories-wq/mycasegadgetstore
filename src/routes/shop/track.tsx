import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Copy, Package, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatKS, formatDate } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/shop/track")({ component: TrackPage });

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pending: "bg-amber-500/15 text-amber-600",
    paid: "bg-blue-500/15 text-blue-600",
    processing: "bg-purple-500/15 text-purple-600",
    completed: "bg-green-500/15 text-green-600",
    confirmed: "bg-blue-500/15 text-blue-600",
    shipped: "bg-purple-500/15 text-purple-600",
    delivered: "bg-green-500/15 text-green-600",
    cancelled: "bg-red-500/15 text-red-600",
  };
  return <Badge variant="outline" className={map[status] ?? ""}>{status}</Badge>;
}

function TrackPage() {
  const [trackingCode, setTrackingCode] = useState("");
  const [submitted, setSubmitted] = useState<{ orderId: string; capability: string } | null>(null);

  useEffect(() => {
    try {
      const savedCode = localStorage.getItem("mycase-guest-order-tracking") ?? "";
      if (savedCode) {
        setTrackingCode(savedCode);
        const [orderId, capability] = savedCode.split(".", 2);
        if (orderId && capability) setSubmitted({ orderId, capability });
      }
    } catch (error) {
      console.warn("Unable to read saved guest order tracking code", error);
    }
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ["guest-order-track", submitted?.orderId, submitted?.capability],
    enabled: !!submitted,
    queryFn: async () => {
      const { data: orderData, error: lookupError } = await (supabase as any).rpc(
        "get_guest_order_status",
        {
          p_order_id: submitted!.orderId,
          p_guest_capability: submitted!.capability,
        },
      );
      if (lookupError || !orderData) {
        throw new Error("Order not found or tracking code is invalid");
      }
      return { order: orderData };
    },
    retry: false,
  });

  const submit = () => {
    const [orderId, capability] = trackingCode.trim().split(".", 2);
    if (!orderId || !capability || capability.length < 32) {
      setSubmitted(null);
      return;
    }
    setSubmitted({ orderId, capability });
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(trackingCode);
    } catch {
      // The code remains visible/selectable if clipboard access is unavailable.
    }
  };

  const order = data?.order;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/shop" className="inline-flex items-center text-sm font-semibold">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to shop
          </Link>
          <h1 className="text-sm font-medium">Track Guest Order</h1>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        <Card>
          <CardContent className="space-y-3 p-4">
            <h2 className="text-base font-semibold">Secure order lookup</h2>
            <p className="text-sm text-muted-foreground">
              သင့် Order ရဲ့ Tracking Code ကို ဒီ Browser မှာ အလိုအလျောက် သိမ်းထားပါတယ်။ အခြား Device မှာ ကြည့်လိုပါက Code ကို ကူးယူသိမ်းထားပါ။
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={trackingCode}
                onChange={(event) => {
                  setTrackingCode(event.target.value);
                  setSubmitted(null);
                }}
                placeholder="Order tracking code"
                aria-label="Order tracking code"
                autoComplete="off"
              />
              <Button onClick={submit} disabled={!trackingCode.trim()} className="sm:shrink-0">
                <Search className="mr-2 h-4 w-4" /> Track order
              </Button>
            </div>
            {trackingCode && (
              <Button variant="outline" size="sm" onClick={copyCode}>
                <Copy className="mr-2 h-4 w-4" /> Copy tracking code
              </Button>
            )}
          </CardContent>
        </Card>

        {isLoading && <p className="py-6 text-center text-muted-foreground">Searching…</p>}
        {error && (
          <Card>
            <CardContent className="p-6 text-center text-sm text-red-600">
              Order not found or tracking code is invalid. Please check the code and try again.
            </CardContent>
          </Card>
        )}
        {order && (
          <Card>
            <CardContent className="space-y-4 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    <span className="font-semibold">Order #{order.order_no}</span>
                    {statusBadge(order.status)}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDate(order.created_at)}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatKS(Number(order.total))}</p>
                  <Badge variant="outline" className="text-[10px]">{order.payment_status}</Badge>
                </div>
              </div>
              <div className="space-y-2 border-t pt-3 text-sm">
                {(order.items ?? []).map((item: any) => (
                  <div key={item.id} className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p>{item.product_name} ×{item.quantity}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={item.fulfillment_type === "PREORDER"
                            ? "text-[10px] bg-amber-500/10 text-amber-700"
                            : "text-[10px] bg-emerald-500/10 text-emerald-700"}
                        >
                          {item.fulfillment_type === "PREORDER" ? "Pre-order" : "In-stock"}
                        </Badge>
                        {item.fulfillment_type === "PREORDER" && item.estimated_arrival && (
                          <span className="text-[11px] text-muted-foreground">ETA: {item.estimated_arrival}</span>
                        )}
                        {item.fulfillment_type === "PREORDER" && Number(item.deposit_required ?? 0) > 0 && (
                          <span className="text-[11px] text-muted-foreground">
                            Deposit: {formatKS(Number(item.deposit_required))}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0">{formatKS(Number(item.line_total))}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {!submitted && (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Guest order တင်ပြီးနောက် Tracking Code ကို ဒီနေရာမှာ အလိုအလျောက် ပြပေးပါမယ်။ Member အကောင့်နဲ့ ဝယ်ယူထားပါက <Link to="/shop/login" className="font-medium text-primary underline">Sign in</Link> ဝင်ပြီး Account မှာ Order History ကို ကြည့်နိုင်ပါတယ်။
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
