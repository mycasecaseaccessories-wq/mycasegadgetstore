import { createFileRoute } from "@tanstack/react-router";
import { RequireAdmin } from "@/components/RequireAdmin";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download, Printer, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatKS } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/reports")({ component: () => <RequireAdmin><ReportsPage /></RequireAdmin> });

type Order = { id: string; order_no: number; customer_name: string | null; customer_phone: string | null; order_source: string | null; total: number; deposit_amount: number; balance_amount: number; payment_status: string; delivery_status: string; created_at: string };
type Purchase = { po_no: number; supplier_name: string | null; status: string; total: number; ordered_at: string; received_at: string | null };
type Expense = { amount: number; category: string; spent_at: string };

function dateTime(date: string, end = false) { return `${date}T${end ? "23:59:59" : "00:00:00"}`; }
function csvValue(value: unknown) { return `"${String(value ?? "").replace(/"/g, '""')}"`; }

function ReportsPage() {
  const today = new Date();
  const [from, setFrom] = useState(new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const range = { from: dateTime(from), to: dateTime(to, true) };
  const queryOptions = { enabled: Boolean(from && to) };

  const { data: orders = [], isLoading: ordersLoading } = useQuery({ queryKey: ["phase-c-orders", from, to], ...queryOptions, queryFn: async () => {
    const { data, error } = await supabase.from("orders").select("id, order_no, customer_name, customer_phone, order_source, total, deposit_amount, balance_amount, payment_status, delivery_status, created_at").gte("created_at", range.from).lte("created_at", range.to).neq("status", "cancelled").order("created_at", { ascending: false });
    if (error) throw error; return (data ?? []) as Order[];
  }});
  const { data: purchases = [] } = useQuery({ queryKey: ["phase-c-purchases", from, to], ...queryOptions, queryFn: async () => {
    const { data, error } = await supabase.from("purchase_orders").select("po_no, supplier_name, status, total, ordered_at, received_at").gte("ordered_at", from).lte("ordered_at", to).order("ordered_at", { ascending: false });
    if (error) throw error; return (data ?? []) as Purchase[];
  }});
  const { data: expenses = [] } = useQuery({ queryKey: ["phase-c-expenses", from, to], ...queryOptions, queryFn: async () => {
    const { data, error } = await supabase.from("expenses").select("amount, category, spent_at").gte("spent_at", from).lte("spent_at", to).order("spent_at", { ascending: false });
    if (error) throw error; return (data ?? []) as Expense[];
  }});

  const metrics = useMemo(() => {
    const sales = orders.reduce((sum, row) => sum + Number(row.total || 0), 0);
    const collected = orders.reduce((sum, row) => sum + Number(row.deposit_amount || 0), 0);
    const purchaseCost = purchases.reduce((sum, row) => sum + Number(row.total || 0), 0);
    const expenseCost = expenses.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    return { sales, collected, receivable: Math.max(0, sales - collected), purchaseCost, expenseCost, profit: sales - purchaseCost - expenseCost };
  }, [orders, purchases, expenses]);
  const customerHistory = useMemo(() => {
    const map = new Map<string, { name: string; phone: string; orders: number; total: number; paid: number; balance: number }>();
    orders.forEach((row) => { const key = row.customer_phone || row.customer_name || "Unknown"; const item = map.get(key) ?? { name: row.customer_name || "Unknown", phone: row.customer_phone || "", orders: 0, total: 0, paid: 0, balance: 0 }; item.orders += 1; item.total += Number(row.total || 0); item.paid += Number(row.deposit_amount || 0); item.balance += Number(row.balance_amount || 0); map.set(key, item); });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [orders]);
  const byDay = useMemo(() => { const map = new Map<string, number>(); orders.forEach((row) => { const date = row.created_at.slice(0, 10); map.set(date, (map.get(date) || 0) + Number(row.total || 0)); }); return Array.from(map.entries()).sort().map(([date, total]) => ({ date, total })); }, [orders]);

  const exportCsv = () => {
    const rows = [
      ["Section", "Reference", "Customer / Supplier", "Phone", "Status", "Total", "Paid / Received", "Balance", "Date"],
      ...orders.map((row) => ["SALE", row.order_no, row.customer_name, row.customer_phone, `${row.order_source || "ONLINE"} · ${row.delivery_status}`, row.total, row.deposit_amount, row.balance_amount, row.created_at]),
      ...purchases.map((row) => ["PURCHASE", row.po_no, row.supplier_name, "", row.status, row.total, row.received_at ? "RECEIVED" : "", "", row.ordered_at]),
      ...expenses.map((row) => ["EXPENSE", row.category, "", "", "", row.amount, "", "", row.spent_at]),
    ];
    const blob = new Blob(["\uFEFF" + rows.map((row) => row.map(csvValue).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `phase-c-report-${from}-to-${to}.csv`; anchor.click(); URL.revokeObjectURL(url); toast.success("Report CSV exported");
  };

  return <div className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Phase C</p><h2 className="mt-1 text-2xl font-bold">Reports & Profit</h2><p className="text-sm text-muted-foreground">Sales, purchases, expenses, customer history, and collection balance in one date range.</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print / PDF</Button><Button variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />Export report CSV</Button></div></div>
    <Card><CardContent className="flex flex-wrap items-end gap-3 p-4"><div className="space-y-1.5"><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div><div className="space-y-1.5"><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={() => { const d = new Date(); setFrom(new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)); setTo(d.toISOString().slice(0, 10)); }}>This month</Button><Button size="sm" variant="secondary" onClick={() => { const d = new Date(); const start = new Date(d); start.setDate(d.getDate() - 29); setFrom(start.toISOString().slice(0, 10)); setTo(d.toISOString().slice(0, 10)); }}>Last 30 days</Button></div></CardContent></Card>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6"><Stat label="Sales" value={formatKS(metrics.sales)} /><Stat label="Collected" value={formatKS(metrics.collected)} /><Stat label="Receivable" value={formatKS(metrics.receivable)} /><Stat label="Purchases" value={formatKS(metrics.purchaseCost)} /><Stat label="Expenses" value={formatKS(metrics.expenseCost)} /><Stat label="Net profit" value={formatKS(metrics.profit)} positive={metrics.profit >= 0} /></div>
    <div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle className="text-base">Daily sales</CardTitle></CardHeader><CardContent>{byDay.length ? <div className="space-y-2">{byDay.map((row) => <div key={row.date} className="flex items-center gap-3 text-sm"><span className="w-24 text-muted-foreground">{row.date}</span><div className="h-2 flex-1 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${Math.max(4, Math.round((row.total / Math.max(...byDay.map((item) => item.total))) * 100))}%` }} /></div><span className="w-28 text-right font-medium">{formatKS(row.total)}</span></div>)}</div> : <Empty text={ordersLoading ? "Loading…" : "No sales in this range"} />}</CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4 text-primary" />Purchase and expense summary</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><Summary label="Sales orders" value={`${orders.length} records`} /><Summary label="Purchase orders" value={`${purchases.length} records`} /><Summary label="Received purchases" value={`${purchases.filter((row) => row.status === "received" || row.received_at).length} records`} /><Summary label="Expense entries" value={`${expenses.length} records`} /></CardContent></Card></div>
    <Card><CardHeader><CardTitle className="text-base">Customer history</CardTitle></CardHeader><CardContent className="overflow-x-auto p-0"><table className="w-full min-w-[680px] text-sm"><thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Customer</th><th>Phone</th><th>Orders</th><th>Total</th><th>Paid</th><th className="pr-4">Balance</th></tr></thead><tbody>{customerHistory.length ? customerHistory.map((row) => <tr key={`${row.name}-${row.phone}`} className="border-t"><td className="px-4 py-3 font-medium">{row.name}</td><td>{row.phone || "—"}</td><td>{row.orders}</td><td>{formatKS(row.total)}</td><td className="text-emerald-600">{formatKS(row.paid)}</td><td className="pr-4 text-amber-600">{formatKS(row.balance)}</td></tr>) : <tr><td colSpan={6}><Empty text="No customer history in this range" /></td></tr>}</tbody></table></CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Recent transactions</CardTitle></CardHeader><CardContent className="overflow-x-auto p-0"><table className="w-full min-w-[800px] text-sm"><thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Type</th><th>Reference</th><th>Customer / Supplier</th><th>Status</th><th>Total</th><th className="pr-4">Date</th></tr></thead><tbody>{orders.slice(0, 25).map((row) => <tr key={row.id} className="border-t"><td className="px-4 py-3"><Badge variant="outline">{row.order_source || "ONLINE"}</Badge></td><td>#{row.order_no}</td><td>{row.customer_name || "—"}</td><td>{row.payment_status} · {row.delivery_status}</td><td>{formatKS(row.total)}</td><td className="pr-4">{row.created_at.slice(0, 10)}</td></tr>)}{!orders.length && <tr><td colSpan={6}><Empty text="No sales in this range" /></td></tr>}</tbody></table></CardContent></Card>
  </div>;
}
function Stat({ label, value, positive }: { label: string; value: string; positive?: boolean }) { return <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className={`mt-1 text-lg font-semibold ${positive === false ? "text-destructive" : positive ? "text-emerald-600" : ""}`}>{value}</p></CardContent></Card>; }
function Summary({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between border-b pb-2 last:border-0"><span className="text-muted-foreground">{label}</span><span className="font-medium">{value}</span></div>; }
function Empty({ text }: { text: string }) { return <p className="py-8 text-center text-sm text-muted-foreground">{text}</p>; }
