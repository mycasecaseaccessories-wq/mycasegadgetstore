import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download, ArrowUpDown, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatKS } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ledger")({ component: LedgerPage });

type Granularity = "day" | "month" | "year";
type SortDir = "asc" | "desc";

function rangeFor(g: Granularity, value: string): { from: string; to: string } {
  if (g === "day") {
    return { from: `${value}T00:00:00`, to: `${value}T23:59:59` };
  }
  if (g === "month") {
    const [y, m] = value.split("-").map(Number);
    const from = `${value}-01T00:00:00`;
    const next = new Date(y, m, 1);
    return { from, to: new Date(next.getTime() - 1).toISOString() };
  }
  // year
  const y = Number(value);
  return { from: `${y}-01-01T00:00:00`, to: `${y}-12-31T23:59:59` };
}

function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = rows.map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

function LedgerPage() {
  const today = new Date();
  const [g, setG] = useState<Granularity>("month");
  const [day, setDay] = useState(today.toISOString().slice(0, 10));
  const [month, setMonth] = useState(today.toISOString().slice(0, 7));
  const [year, setYear] = useState(String(today.getFullYear()));
  const value = g === "day" ? day : g === "month" ? month : year;
  const range = useMemo(() => rangeFor(g, value), [g, value]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="space-y-1.5">
            <Label>View</Label>
            <Select value={g} onValueChange={(v) => setG(v as Granularity)}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Day</SelectItem>
                <SelectItem value="month">Month</SelectItem>
                <SelectItem value="year">Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {g === "day" && (
            <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={day} onChange={e => setDay(e.target.value)} /></div>
          )}
          {g === "month" && (
            <div className="space-y-1.5"><Label>Month</Label><Input type="month" value={month} onChange={e => setMonth(e.target.value)} /></div>
          )}
          {g === "year" && (
            <div className="space-y-1.5"><Label>Year</Label><Input type="number" value={year} onChange={e => setYear(e.target.value)} className="w-[120px]" /></div>
          )}
          <p className="ml-auto text-xs text-muted-foreground">{range.from.slice(0,10)} → {range.to.slice(0,10)}</p>
        </CardContent>
      </Card>

      <Tabs defaultValue="purchases" className="space-y-4">
        <TabsList>
          <TabsTrigger value="purchases">Purchases (အဝယ်)</TabsTrigger>
          <TabsTrigger value="sales">Sales (အရောင်း)</TabsTrigger>
        </TabsList>
        <TabsContent value="purchases"><PurchaseLedger from={range.from} to={range.to} /></TabsContent>
        <TabsContent value="sales"><SalesLedger from={range.from} to={range.to} /></TabsContent>
      </Tabs>
    </div>
  );
}

type PurchaseRow = {
  id: string;
  ordered_at: string;
  po_no: number;
  supplier: string;
  product_name: string;
  variant: string | null;
  quantity: number;
  unit_cost: number;
  line_total: number;
  cargo_status: string;
  tracking_code: string | null;
};

function PurchaseLedger({ from, to }: { from: string; to: string }) {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["ledger-purchases", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_order_items")
        .select("id, product_name, variant, quantity, unit_cost, line_total, cargo_status, tracking_code, po:purchase_orders!inner(id, po_no, supplier_name, ordered_at)")
        .gte("po.ordered_at", from.slice(0, 10))
        .lte("po.ordered_at", to.slice(0, 10));
      if (error) throw error;
      return ((data ?? []) as any[]).map(r => ({
        id: r.id,
        ordered_at: r.po?.ordered_at ?? "",
        po_no: r.po?.po_no ?? 0,
        supplier: r.po?.supplier_name ?? "—",
        product_name: r.product_name,
        variant: r.variant,
        quantity: Number(r.quantity ?? 0),
        unit_cost: Number(r.unit_cost ?? 0),
        line_total: Number(r.line_total ?? 0),
        cargo_status: r.cargo_status,
        tracking_code: r.tracking_code,
      })) as PurchaseRow[];
    },
  });

  return (
    <LedgerTable
      kind="purchases"
      isLoading={isLoading}
      rows={rows}
      dateKey="ordered_at"
      groupBy="month"
      columns={[
        { key: "ordered_at", label: "Date", type: "text" },
        { key: "po_no", label: "PO #", type: "text", render: (r) => `#${r.po_no}` },
        { key: "supplier", label: "Supplier", type: "text" },
        { key: "product_name", label: "Product", type: "text" },
        { key: "variant", label: "Variant", type: "text" },
        { key: "quantity", label: "Qty", type: "number", editable: true, align: "right" },
        { key: "unit_cost", label: "Unit Cost", type: "money", editable: true, align: "right" },
        { key: "line_total", label: "Total", type: "money", align: "right" },
        { key: "cargo_status", label: "Cargo", type: "text" },
      ]}
      onSave={async (row, patch) => {
        const next: any = { ...patch };
        if ("quantity" in patch || "unit_cost" in patch) {
          const q = Number(patch.quantity ?? row.quantity);
          const u = Number(patch.unit_cost ?? row.unit_cost);
          next.line_total = q * u;
        }
        const { error } = await supabase.from("purchase_order_items").update(next).eq("id", row.id);
        if (error) { toast.error(error.message); return false; }
        toast.success("Updated");
        qc.invalidateQueries({ queryKey: ["ledger-purchases"] });
        return true;
      }}
      totals={(rs) => ({ qty: rs.reduce((s, r) => s + r.quantity, 0), amount: rs.reduce((s, r) => s + r.line_total, 0) })}
    />
  );
}

type SalesRow = {
  id: string;
  order_at: string;
  order_no: number;
  customer: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  payment_status: string;
};

function SalesLedger({ from, to }: { from: string; to: string }) {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["ledger-sales", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("id, product_name, quantity, unit_price, line_total, order:orders!inner(id, order_no, customer_name, order_date, status, payment_status)")
        .gte("order.order_date", from)
        .lte("order.order_date", to)
        .neq("order.status", "cancelled");
      if (error) throw error;
      return ((data ?? []) as any[]).map(r => ({
        id: r.id,
        order_at: r.order?.order_date ?? "",
        order_no: r.order?.order_no ?? 0,
        customer: r.order?.customer_name ?? "—",
        product_name: r.product_name,
        quantity: Number(r.quantity ?? 0),
        unit_price: Number(r.unit_price ?? 0),
        line_total: Number(r.line_total ?? 0),
        payment_status: r.order?.payment_status ?? "",
      })) as SalesRow[];
    },
  });

  return (
    <LedgerTable
      kind="sales"
      isLoading={isLoading}
      rows={rows}
      dateKey="order_at"
      groupBy="month"
      columns={[
        { key: "order_at", label: "Date", type: "text", render: (r) => new Date(r.order_at).toLocaleDateString() },
        { key: "order_no", label: "Order #", type: "text", render: (r) => `#${r.order_no}` },
        { key: "customer", label: "Customer", type: "text" },
        { key: "product_name", label: "Product", type: "text" },
        { key: "quantity", label: "Qty", type: "number", editable: true, align: "right" },
        { key: "unit_price", label: "Unit Price", type: "money", editable: true, align: "right" },
        { key: "line_total", label: "Total", type: "money", align: "right" },
        { key: "payment_status", label: "Payment", type: "text" },
      ]}
      onSave={async (row, patch) => {
        const next: any = { ...patch };
        if ("quantity" in patch || "unit_price" in patch) {
          const q = Number(patch.quantity ?? row.quantity);
          const u = Number(patch.unit_price ?? row.unit_price);
          next.line_total = q * u;
        }
        const { error } = await supabase.from("order_items").update(next).eq("id", row.id);
        if (error) { toast.error(error.message); return false; }
        toast.success("Updated");
        qc.invalidateQueries({ queryKey: ["ledger-sales"] });
        return true;
      }}
      totals={(rs) => ({ qty: rs.reduce((s, r) => s + r.quantity, 0), amount: rs.reduce((s, r) => s + r.line_total, 0) })}
    />
  );
}

type ColType = "text" | "number" | "money";
type Column<T> = {
  key: keyof T & string;
  label: string;
  type: ColType;
  editable?: boolean;
  align?: "left" | "right";
  render?: (r: T) => React.ReactNode;
};

function LedgerTable<T extends { id: string }>({
  kind, rows, columns, dateKey, groupBy, onSave, totals, isLoading,
}: {
  kind: "purchases" | "sales";
  rows: T[];
  columns: Column<T>[];
  dateKey: keyof T & string;
  groupBy: "month";
  onSave: (row: T, patch: Partial<T>) => Promise<boolean>;
  totals: (rs: T[]) => { qty: number; amount: number };
  isLoading: boolean;
}) {
  const [sortKey, setSortKey] = useState<string>(dateKey);
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<T>>({});

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a: any, b: any) => {
      const av = a[sortKey], bv = b[sortKey];
      if (av == null) return 1; if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return sortDir === "asc" ? av - bv : bv - av;
      return sortDir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  // group by month based on dateKey
  const groups = useMemo(() => {
    const map = new Map<string, T[]>();
    for (const r of sorted) {
      const d = String((r as any)[dateKey] ?? "").slice(0, 7);
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(r);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [sorted, dateKey]);

  const grand = totals(rows);

  const exportCsv = () => {
    const header = columns.map(c => c.label);
    const data = sorted.map(r => columns.map(c => {
      const v = (r as any)[c.key];
      if (c.type === "money" || c.type === "number") return v ?? 0;
      return v ?? "";
    }));
    downloadCsv(`${kind}-ledger-${new Date().toISOString().slice(0,10)}.csv`, [header, ...data]);
  };

  const toggleSort = (k: string) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  };

  const startEdit = (r: T) => { setEditingId(r.id); setDraft({}); };
  const cancelEdit = () => { setEditingId(null); setDraft({}); };
  const saveEdit = async (r: T) => {
    if (Object.keys(draft).length === 0) { cancelEdit(); return; }
    const ok = await onSave(r, draft);
    if (ok) cancelEdit();
  };

  const renderCell = (c: Column<T>, r: T) => {
    if (editingId === r.id && c.editable) {
      const v = (draft as any)[c.key] ?? (r as any)[c.key] ?? "";
      return (
        <Input
          type={c.type === "text" ? "text" : "number"}
          value={v}
          onChange={(e) => setDraft({ ...draft, [c.key]: c.type === "text" ? e.target.value : Number(e.target.value) } as any)}
          className="h-8 w-28"
        />
      );
    }
    if (c.render) return c.render(r);
    const v = (r as any)[c.key];
    if (c.type === "money") return formatKS(Number(v ?? 0));
    if (c.type === "number") return Number(v ?? 0).toLocaleString();
    return v ?? "—";
  };

  return (
    <Card><CardContent className="p-0">
      <div className="flex items-center justify-between gap-2 p-3">
        <div className="text-sm text-muted-foreground">
          {isLoading ? "Loading…" : `${rows.length} rows · Total Qty ${grand.qty.toLocaleString()} · `}
          <b>{formatKS(grand.amount)}</b>
        </div>
        <Button size="sm" variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />CSV</Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              {columns.map(c => (
                <th key={c.key} className={`px-3 py-2 ${c.align === "right" ? "text-right" : ""}`}>
                  <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort(c.key)}>
                    {c.label} <ArrowUpDown className="h-3 w-3 opacity-50" />
                  </button>
                </th>
              ))}
              <th className="px-3 py-2 text-right">Edit</th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 && !isLoading && (
              <tr><td colSpan={columns.length + 1} className="px-4 py-8 text-center text-muted-foreground">No records</td></tr>
            )}
            {groups.map(([month, list]) => {
              const t = totals(list);
              return (
                <>
                  <tr key={`h-${month}`} className="border-t bg-muted/30">
                    <td colSpan={columns.length + 1} className="px-3 py-1.5 text-xs font-semibold">
                      {month} · {list.length} lines · Qty {t.qty.toLocaleString()} · {formatKS(t.amount)}
                    </td>
                  </tr>
                  {list.map(r => (
                    <tr key={r.id} className="border-t hover:bg-muted/20">
                      {columns.map(c => (
                        <td key={c.key} className={`px-3 py-2 ${c.align === "right" ? "text-right" : ""}`}>{renderCell(c, r)}</td>
                      ))}
                      <td className="px-3 py-2 text-right">
                        {editingId === r.id ? (
                          <div className="inline-flex gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveEdit(r)}><Check className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit}><X className="h-4 w-4" /></Button>
                          </div>
                        ) : (
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(r)}><Pencil className="h-4 w-4" /></Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </CardContent></Card>
  );
}
