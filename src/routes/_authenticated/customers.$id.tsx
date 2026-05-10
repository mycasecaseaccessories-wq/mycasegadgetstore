import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ShoppingCart, Wallet, Hash, Receipt, MessageCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatKS, formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/customers/$id")({ component: CustomerProfile });

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-600",
  paid: "bg-blue-500/15 text-blue-600",
  processing: "bg-purple-500/15 text-purple-600",
  completed: "bg-green-500/15 text-green-600",
  cancelled: "bg-red-500/15 text-red-600",
};

function CustomerProfile() {
  const { id } = Route.useParams();

  const { data: customer } = useQuery({
    queryKey: ["customer", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["customer-orders", id, customer?.phone],
    queryFn: async () => {
      let q = supabase.from("orders").select("*").order("created_at", { ascending: false });
      q = customer?.phone
        ? q.or(`customer_id.eq.${id},customer_phone.eq.${customer.phone}`)
        : q.eq("customer_id", id);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!customer,
  });

  const total = orders.filter(o => o.status !== "cancelled").reduce((s, o) => s + Number(o.total), 0);
  const paid = orders.filter(o => o.payment_status === "paid").reduce((s, o) => s + Number(o.total), 0);
  const pending = total - paid;

  if (!customer) {
    return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild><Link to="/customers"><ArrowLeft className="mr-2 h-4 w-4" />Back to customers</Link></Button>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-2xl font-bold text-primary-foreground">
              {customer.name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold">{customer.name}</h2>
              {customer.phone && <p className="text-sm text-muted-foreground">📞 {customer.phone}</p>}
              {customer.address && <p className="mt-1 text-sm text-muted-foreground">📍 {customer.address}</p>}
              {customer.note && <p className="mt-2 text-sm italic">{customer.note}</p>}
              <p className="mt-2 text-xs text-muted-foreground">Joined {formatDateTime(customer.created_at)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={<ShoppingCart className="h-4 w-4" />} label="Orders" value={String(orders.length)} />
        <Stat icon={<Wallet className="h-4 w-4" />} label="Total Spent" value={formatKS(total)} />
        <Stat icon={<Receipt className="h-4 w-4" />} label="Paid" value={formatKS(paid)} />
        <Stat icon={<Hash className="h-4 w-4" />} label="Pending" value={formatKS(pending)} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Order History</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr><th className="px-4 py-3">Order</th><th>Date</th><th>Status</th><th>Payment</th><th className="text-right pr-4">Total</th></tr>
            </thead>
            <tbody>
              {orders.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No orders yet</td></tr>}
              {orders.map(o => (
                <tr key={o.id} className="border-t">
                  <td className="px-4 py-3 font-medium">#{o.order_no}</td>
                  <td className="text-muted-foreground">{formatDateTime(o.created_at)}</td>
                  <td><Badge variant="outline" className={statusColors[o.status] ?? ""}>{o.status}</Badge></td>
                  <td><Badge variant="outline" className={o.payment_status === "paid" ? "bg-green-500/10 text-green-600" : "bg-amber-500/10 text-amber-600"}>{o.payment_status}</Badge></td>
                  <td className="pr-4 text-right font-medium">{formatKS(Number(o.total))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card><CardContent className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground">{icon}<span className="text-xs">{label}</span></div>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </CardContent></Card>
  );
}
