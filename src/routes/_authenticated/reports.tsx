import { createFileRoute } from "@tanstack/react-router";
import { RequireAdmin } from "@/components/RequireAdmin";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { formatKS } from "@/lib/format";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/_authenticated/reports")({
  component: () => (
    <RequireAdmin>
      <ReportsPage />
    </RequireAdmin>
  ),
});

function ReportsPage() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 30);
  const [from, setFrom] = useState(monthAgo.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));

  const { data: orders = [] } = useQuery({
    queryKey: ["report-orders", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .gte("created_at", from + "T00:00:00")
        .lte("created_at", to + "T23:59:59")
        .neq("status", "cancelled");
      if (error) throw error;
      return data;
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["report-items", from, to],
    queryFn: async () => {
      const { data } = await supabase
        .from("order_items")
        .select("product_name, quantity, line_total, created_at")
        .gte("created_at", from + "T00:00:00")
        .lte("created_at", to + "T23:59:59");
      return data ?? [];
    },
  });

  const totals = useMemo(() => {
    let day = 0,
      week = 0,
      month = 0;
    const now = Date.now();
    for (const o of orders) {
      const t = new Date(o.created_at).getTime();
      const v = Number(o.total);
      if (now - t < 86400000) day += v;
      if (now - t < 7 * 86400000) week += v;
      if (now - t < 30 * 86400000) month += v;
    }
    return { day, week, month, total: orders.reduce((s, o) => s + Number(o.total), 0) };
  }, [orders]);

  const byDay = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of orders) {
      const k = new Date(o.created_at).toISOString().slice(0, 10);
      map[k] = (map[k] ?? 0) + Number(o.total);
    }
    return Object.entries(map)
      .sort()
      .map(([date, total]) => ({ date: date.slice(5), total }));
  }, [orders]);

  const topProducts = useMemo(() => {
    const map = new Map<string, { qty: number; total: number }>();
    for (const it of items) {
      const cur = map.get(it.product_name) ?? { qty: 0, total: 0 };
      cur.qty += it.quantity;
      cur.total += Number(it.line_total);
      map.set(it.product_name, cur);
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [items]);

  const exportCsv = () => {
    const rows = [
      [
        "Order No",
        "Customer",
        "Phone",
        "Status",
        "Payment",
        "Subtotal",
        "Discount",
        "Extra Fee",
        "Total",
        "Date",
      ],
      ...orders.map((o) => [
        o.order_no,
        o.customer_name ?? "",
        o.customer_phone ?? "",
        o.status,
        o.payment_status,
        o.subtotal,
        o.discount,
        o.extra_fee,
        o.total,
        o.created_at,
      ]),
    ];
    const csv = rows
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="flex flex-wrap gap-2">
            {(
              [
                { k: "today", label: "Today", days: 0 },
                { k: "week", label: "Last 7 days", days: 6 },
                { k: "month", label: "Last 30 days", days: 29 },
                { k: "ytd", label: "This month", days: -1 },
              ] as const
            ).map((p) => (
              <Button
                key={p.k}
                size="sm"
                variant="secondary"
                onClick={() => {
                  const end = new Date();
                  end.setHours(0, 0, 0, 0);
                  let start = new Date(end);
                  if (p.days === -1) start = new Date(end.getFullYear(), end.getMonth(), 1);
                  else start.setDate(end.getDate() - p.days);
                  setFrom(start.toISOString().slice(0, 10));
                  setTo(end.toISOString().slice(0, 10));
                }}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button onClick={exportCsv} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Today" value={formatKS(totals.day)} />
        <Stat label="Last 7 days" value={formatKS(totals.week)} />
        <Stat label="Last 30 days" value={formatKS(totals.month)} />
        <Stat label="Range total" value={formatKS(totals.total)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daily Revenue</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byDay}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip
                formatter={(v: number) => formatKS(v)}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                }}
              />
              <Bar dataKey="total" fill="var(--primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Best Selling Products (Top 10)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {topProducts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No sales in this range</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={Math.max(220, topProducts.length * 32)}>
                <BarChart data={topProducts} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    className="text-xs"
                    tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={140}
                    className="text-xs"
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload as { name: string; qty: number; total: number };
                      const avg = p.qty > 0 ? p.total / p.qty : 0;
                      return (
                        <div className="rounded-lg border bg-popover p-3 shadow-md text-xs min-w-[180px]">
                          <p className="font-semibold text-sm mb-2 truncate">{p.name}</p>
                          <div className="space-y-1">
                            <div className="flex justify-between gap-4">
                              <span className="text-muted-foreground">Qty Sold</span>
                              <span className="font-medium">
                                {p.qty.toLocaleString("en-US", { maximumFractionDigits: 0 })} pcs
                              </span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-muted-foreground">Revenue</span>
                              <span className="font-medium text-primary">{formatKS(p.total)}</span>
                            </div>
                            <div className="flex justify-between gap-4 border-t pt-1 mt-1">
                              <span className="text-muted-foreground">Avg / unit</span>
                              <span className="font-medium">{formatKS(Math.round(avg))}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="total" fill="var(--primary)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 w-10">#</th>
                      <th>Product</th>
                      <th>Qty Sold</th>
                      <th className="text-right pr-4">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.map((p, i) => (
                      <tr key={p.name} className="border-t">
                        <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                        <td className="font-medium">{p.name}</td>
                        <td>{p.qty}</td>
                        <td className="text-right pr-4 font-medium">{formatKS(p.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-lg font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
