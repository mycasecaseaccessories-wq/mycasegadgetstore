import { createFileRoute } from "@tanstack/react-router";
import { RequireAdmin } from "@/components/RequireAdmin";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { formatKS } from "@/lib/format";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

export const Route = createFileRoute("/_authenticated/analytics")({ component: () => <RequireAdmin><AnalyticsPage /></RequireAdmin> });

const COLORS = ["var(--primary)", "var(--accent)", "var(--chart-3, hsl(280 80% 60%))", "var(--chart-4, hsl(40 90% 55%))", "var(--chart-5, hsl(160 70% 45%))"];

function AnalyticsPage() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const monthAgo = new Date(today); monthAgo.setDate(monthAgo.getDate() - 30);
  const [from, setFrom] = useState(monthAgo.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));

  const { data: orders = [] } = useQuery({
    queryKey: ["a-orders", from, to],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*")
        .gte("created_at", from + "T00:00:00").lte("created_at", to + "T23:59:59");
      if (error) throw error;
      return data;
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["a-items", from, to],
    queryFn: async () => {
      const { data } = await supabase.from("order_items").select("product_name, quantity, line_total, created_at, unit_price")
        .gte("created_at", from + "T00:00:00").lte("created_at", to + "T23:59:59");
      return data ?? [];
    },
  });

  const stats = useMemo(() => {
    const ok = orders.filter(o => o.status !== "cancelled");
    const revenue = ok.reduce((s, o) => s + Number(o.total), 0);
    const count = ok.length;
    const avg = count ? revenue / count : 0;
    const paid = ok.filter(o => o.payment_status === "paid").reduce((s, o) => s + Number(o.total), 0);
    const pending = revenue - paid;
    const cancelled = orders.length - count;
    return { revenue, count, avg, paid, pending, cancelled };
  }, [orders]);

  const trend = useMemo(() => {
    const map: Record<string, { date: string; revenue: number; orders: number }> = {};
    for (const o of orders) {
      if (o.status === "cancelled") continue;
      const k = new Date(o.created_at).toISOString().slice(0, 10);
      map[k] = map[k] ?? { date: k, revenue: 0, orders: 0 };
      map[k].revenue += Number(o.total);
      map[k].orders += 1;
    }
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date)).map(d => ({ ...d, date: d.date.slice(5) }));
  }, [orders]);

  const statusBreak = useMemo(() => {
    const m: Record<string, number> = {};
    for (const o of orders) m[o.status] = (m[o.status] ?? 0) + 1;
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [orders]);

  const paymentBreak = useMemo(() => {
    const m: Record<string, number> = {};
    for (const o of orders) if (o.status !== "cancelled") m[o.payment_status] = (m[o.payment_status] ?? 0) + 1;
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [orders]);

  const topProducts = useMemo(() => {
    const m = new Map<string, { qty: number; revenue: number }>();
    for (const it of items) {
      const c = m.get(it.product_name) ?? { qty: 0, revenue: 0 };
      c.qty += it.quantity; c.revenue += Number(it.line_total);
      m.set(it.product_name, c);
    }
    return Array.from(m, ([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  }, [items]);

  const hourly = useMemo(() => {
    const arr = Array.from({ length: 24 }, (_, h) => ({ hour: `${h}:00`, orders: 0 }));
    for (const o of orders) if (o.status !== "cancelled") arr[new Date(o.created_at).getHours()].orders++;
    return arr;
  }, [orders]);

  return (
    <div className="space-y-4">
      <Card><CardContent className="flex flex-wrap items-end gap-3 p-4">
        <div className="space-y-1.5"><Label>From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
      </CardContent></Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Stat label="Revenue" value={formatKS(stats.revenue)} />
        <Stat label="Orders" value={String(stats.count)} />
        <Stat label="Avg Order" value={formatKS(stats.avg)} />
        <Stat label="Paid" value={formatKS(stats.paid)} />
        <Stat label="Pending" value={formatKS(stats.pending)} />
        <Stat label="Cancelled" value={String(stats.cancelled)} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Revenue Trend</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" className="text-xs" /><YAxis className="text-xs" />
              <Tooltip formatter={(v: number) => formatKS(v)} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Area type="monotone" dataKey="revenue" stroke="var(--primary)" fill="url(#rev)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Orders per Day</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" className="text-xs" /><YAxis className="text-xs" />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Line type="monotone" dataKey="orders" stroke="var(--accent)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Order Status</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={statusBreak} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {statusBreak.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Legend /><Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Payment Status</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={paymentBreak} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {paymentBreak.map((_, i) => <Cell key={i} fill={COLORS[(i + 1) % COLORS.length]} />)}
                </Pie>
                <Legend /><Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Orders by Hour</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={hourly}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="hour" className="text-[10px]" interval={2} /><YAxis className="text-xs" />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Bar dataKey="orders" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Top Products by Revenue</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={Math.max(240, topProducts.length * 36)}>
            <BarChart data={topProducts} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis type="number" className="text-xs" /><YAxis type="category" dataKey="name" className="text-xs" width={120} />
              <Tooltip formatter={(v: number) => formatKS(v)} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Bar dataKey="revenue" fill="var(--accent)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card><CardContent className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </CardContent></Card>
  );
}
