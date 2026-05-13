import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TrendingUp,
  ShoppingCart,
  Clock,
  CheckCircle2,
  Users,
  Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatKS, formatDateTime } from "@/lib/format";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { DashboardWidgets } from "@/components/DashboardWidgets";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
  paid: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  processing: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  completed: "bg-green-500/15 text-green-600 dark:text-green-400",
  cancelled: "bg-red-500/15 text-red-600 dark:text-red-400",
};

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      const [orders, customers, items, products, expenses, poItems] = await Promise.all([
        supabase.from("orders").select("*").order("created_at", { ascending: false }),
        supabase.from("customers").select("id"),
        supabase.from("order_items").select("product_name, quantity, line_total, created_at"),
        supabase.from("products").select("id, name, stock_in, sold_qty, low_stock_threshold, status").eq("status", "ACTIVE"),
        supabase.from("expenses").select("amount, spent_at").gte("spent_at", monthStart.toISOString().slice(0, 10)),
        supabase.from("purchase_order_items").select("unit_cost, quantity, product_id, created_at").gte("created_at", monthStart.toISOString()),
      ]);
      if (orders.error) throw orders.error;
      return {
        orders: orders.data ?? [],
        customers: customers.data ?? [],
        items: items.data ?? [],
        products: products.data ?? [],
        expenses: expenses.data ?? [],
        poItems: poItems.data ?? [],
      };
    },
  });

  const orders = data?.orders ?? [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const totalRevenue = orders.filter(o => o.status !== "cancelled").reduce((s, o) => s + Number(o.total), 0);
  const todayRevenue = orders.filter(o => o.status !== "cancelled" && new Date(o.created_at) >= today).reduce((s, o) => s + Number(o.total), 0);
  const pending = orders.filter(o => o.status === "pending").length;
  const completed = orders.filter(o => o.status === "completed").length;

  // sales chart — last 7 days
  const days: { date: string; total: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
    const next = new Date(d); next.setDate(d.getDate() + 1);
    const total = orders
      .filter(o => o.status !== "cancelled" && new Date(o.created_at) >= d && new Date(o.created_at) < next)
      .reduce((s, o) => s + Number(o.total), 0);
    days.push({ date: d.toLocaleDateString("en-GB", { weekday: "short" }), total });
  }

  // top products
  const productMap = new Map<string, number>();
  for (const it of data?.items ?? []) {
    productMap.set(it.product_name, (productMap.get(it.product_name) ?? 0) + Number(it.line_total));
  }
  const topProducts = Array.from(productMap.entries())
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  // Monthly P&L
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const monthOrders = orders.filter(o => o.status !== "cancelled" && new Date(o.created_at) >= monthStart);
  const monthRevenue = monthOrders.reduce((s, o) => s + Number(o.total), 0);
  const monthCOGS = (data?.poItems ?? []).reduce((s, p) => s + Number(p.unit_cost) * Number(p.quantity), 0);
  const monthExpenses = (data?.expenses ?? []).reduce((s, e) => s + Number(e.amount), 0);
  const monthProfit = monthRevenue - monthCOGS - monthExpenses;

  // Low stock alerts
  const lowStock = (data?.products ?? []).filter((p: any) => {
    const remaining = (p.stock_in ?? 0) - (p.sold_qty ?? 0);
    return remaining <= (p.low_stock_threshold ?? 5);
  }).map((p: any) => ({ ...p, remaining: (p.stock_in ?? 0) - (p.sold_qty ?? 0) }))
    .sort((a: any, b: any) => a.remaining - b.remaining);

  // Best sellers by quantity
  const qtyMap = new Map<string, number>();
  for (const it of data?.items ?? []) {
    qtyMap.set(it.product_name, (qtyMap.get(it.product_name) ?? 0) + Number(it.quantity));
  }
  const bestByQty = Array.from(qtyMap.entries()).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty).slice(0, 10);

  const stats = [
    { label: "Total Revenue", value: formatKS(totalRevenue), icon: TrendingUp, accent: "from-primary to-accent" },
    { label: "Today's Revenue", value: formatKS(todayRevenue), icon: Wallet, accent: "from-emerald-500 to-teal-500" },
    { label: "Total Orders", value: orders.length.toString(), icon: ShoppingCart, accent: "from-blue-500 to-indigo-500" },
    { label: "Pending Orders", value: pending.toString(), icon: Clock, accent: "from-amber-500 to-orange-500" },
    { label: "Completed Orders", value: completed.toString(), icon: CheckCircle2, accent: "from-green-500 to-emerald-500" },
    { label: "Customers", value: (data?.customers.length ?? 0).toString(), icon: Users, accent: "from-pink-500 to-rose-500" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <Card key={s.label} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-lg font-semibold">{isLoading ? "—" : s.value}</p>
                </div>
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${s.accent} text-white shadow-sm`}>
                  <s.icon className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Sales — Last 7 Days</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={days}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip formatter={(v: number) => formatKS(v)} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Line type="monotone" dataKey="total" stroke="var(--primary)" strokeWidth={2} dot={{ fill: "var(--primary)" }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Top Products by Revenue</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={topProducts}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip formatter={(v: number) => formatKS(v)} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Bar dataKey="total" fill="var(--accent)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <DashboardWidgets />

      <Card>
        <CardHeader><CardTitle className="text-base">Recent Orders</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr><th className="py-2">Order</th><th>Customer</th><th>Status</th><th>Date</th><th className="text-right">Total</th></tr>
            </thead>
            <tbody>
              {orders.slice(0, 8).map(o => (
                <tr key={o.id} className="border-t">
                  <td className="py-2 font-medium">#{o.order_no}</td>
                  <td>{o.customer_name ?? "—"}</td>
                  <td><Badge variant="outline" className={statusColors[o.status] ?? ""}>{o.status}</Badge></td>
                  <td className="text-muted-foreground">{formatDateTime(o.created_at)}</td>
                  <td className="text-right font-medium">{formatKS(Number(o.total))}</td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No orders yet</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
