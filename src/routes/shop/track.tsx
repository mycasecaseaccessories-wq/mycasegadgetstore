import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatKS, formatDate } from "@/lib/format";

export const Route = createFileRoute("/shop/track")({ component: TrackPage });

function statusBadge(s: string) {
  const map: Record<string, string> = {
    pending: "bg-amber-500/15 text-amber-600",
    confirmed: "bg-blue-500/15 text-blue-600",
    shipped: "bg-purple-500/15 text-purple-600",
    delivered: "bg-green-500/15 text-green-600",
    cancelled: "bg-red-500/15 text-red-600",
  };
  return <Badge variant="outline" className={map[s] ?? ""}>{s}</Badge>;
}

function TrackPage() {
  const [phone, setPhone] = useState("");
  const [orderNo, setOrderNo] = useState("");
  const [submitted, setSubmitted] = useState<{ phone: string; orderNo: string } | null>(null);

  // Auto-fill from logged-in user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const p = (data.user?.user_metadata as any)?.phone || data.user?.phone;
      if (p && !phone) setPhone(p);
    });
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ["track-order", submitted],
    enabled: !!submitted,
    queryFn: async () => {
      let q = supabase.from("orders").select("*, items:order_items(*)").eq("customer_phone", submitted!.phone.trim());
      if (submitted!.orderNo) q = q.eq("order_no", Number(submitted!.orderNo));
      const { data, error } = await q.order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/shop" className="text-sm font-semibold">← Back to shop</Link>
          <h1 className="text-sm font-medium">Track Order</h1>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Card className="mb-4">
          <CardContent className="space-y-3 p-4">
            <h2 className="text-base font-semibold">Find your order</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input placeholder="Phone number *" value={phone} onChange={e => setPhone(e.target.value)} />
              <Input placeholder="Order # (optional)" value={orderNo} onChange={e => setOrderNo(e.target.value)} />
            </div>
            <Button
              onClick={() => phone.trim() && setSubmitted({ phone, orderNo })}
              disabled={!phone.trim()}
              className="w-full sm:w-auto"
            >
              <Search className="mr-2 h-4 w-4" />Track
            </Button>
          </CardContent>
        </Card>

        {submitted && (
          <>
            {isLoading && <p className="py-6 text-center text-muted-foreground">Searching…</p>}
            {error && <p className="py-6 text-center text-red-600">{(error as Error).message}</p>}
            {data && data.length === 0 && (
              <Card><CardContent className="p-6 text-center text-muted-foreground">No orders found for this phone number.</CardContent></Card>
            )}
            <div className="space-y-3">
              {(data ?? []).map((o: any) => (
                <Card key={o.id}>
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4" />
                          <span className="font-semibold">Order #{o.order_no}</span>
                          {statusBadge(o.status)}
                        </div>
                        <p className="text-xs text-muted-foreground">{formatDate(o.created_at)} · {o.customer_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatKS(Number(o.total))}</p>
                        <Badge variant="outline" className="text-[10px]">{o.payment_status}</Badge>
                      </div>
                    </div>
                    <div className="mt-3 space-y-1 border-t pt-3 text-sm">
                      {(o.items ?? []).map((it: any) => (
                        <div key={it.id} className="flex justify-between">
                          <span>{it.product_name} ×{it.quantity}</span>
                          <span>{formatKS(Number(it.line_total))}</span>
                        </div>
                      ))}
                    </div>
                    {o.delivery_note && <p className="mt-2 text-xs text-muted-foreground">📍 {o.delivery_note}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
