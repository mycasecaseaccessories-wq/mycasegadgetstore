import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, PackageCheck, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney, formatDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/purchase-orders")({ component: POPage });

type Item = {
  product_id?: string | null;
  product_name: string;
  variant?: string | null;
  quantity: number;
  thb_price?: number | null;     // per unit in THB
  unit_cost_ks?: number | null;  // per unit in KS (manual)
  tracking_code?: string | null;
  cargo_status: "ordered" | "in_transit" | "arrived";
};

const fmtTHB = (n: number) => `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} ฿`;

function unitCostKS(it: Item, rate: number, currency: "THB" | "KS"): number {
  if (currency === "KS") return Number(it.unit_cost_ks ?? 0);
  return Number(it.thb_price ?? 0) * rate;
}

function POPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState<string>("");
  const [orderedAt, setOrderedAt] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [currency, setCurrency] = useState<"THB" | "KS">("THB");
  const [rate, setRate] = useState<number>(0);
  const [items, setItems] = useState<Item[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [monthFilter, setMonthFilter] = useState<string>(new Date().toISOString().slice(0, 7));

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => (await supabase.from("suppliers").select("id, name").order("name")).data ?? [],
  });
  const { data: products = [] } = useQuery({
    queryKey: ["products-min"],
    queryFn: async () => (await supabase.from("products").select("id, name").order("name")).data ?? [],
  });
  const { data: latestRate } = useQuery({
    queryKey: ["latest-rate"],
    queryFn: async () => {
      const { data } = await supabase.from("rates").select("buy_rate, sell_gap").order("date", { ascending: false }).limit(1).maybeSingle();
      return data;
    },
  });
  const { data: pos = [] } = useQuery({
    queryKey: ["purchase_orders", monthFilter],
    queryFn: async () => {
      const start = `${monthFilter}-01`;
      const [y, m] = monthFilter.split("-").map(Number);
      const next = new Date(y, m, 1).toISOString().slice(0, 10);
      const { data } = await supabase
        .from("purchase_orders")
        .select("*, items:purchase_order_items(*)")
        .gte("ordered_at", start)
        .lt("ordered_at", next)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // Auto-fill rate when opening dialog
  useEffect(() => {
    if (open && rate === 0 && latestRate) {
      const r = Number(latestRate.buy_rate ?? 0) + Number(latestRate.sell_gap ?? 0);
      if (r > 0) setRate(r);
    }
  }, [open, latestRate, rate]);

  const totals = useMemo(() => {
    let ks = 0, thb = 0;
    for (const it of items) {
      ks += it.quantity * unitCostKS(it, rate, currency);
      thb += it.quantity * Number(it.thb_price ?? 0);
    }
    return { ks, thb };
  }, [items, rate, currency]);

  const monthly = useMemo(() => {
    let ksDirect = 0, thbBought = 0, thbInKs = 0, count = 0, lines = 0;
    let arrived = 0, pending = 0;
    for (const p of pos as any[]) {
      count += 1;
      if (p.currency === "THB") {
        thbBought += Number(p.thb_total ?? 0);
        thbInKs += Number(p.total ?? 0);
      } else {
        ksDirect += Number(p.total ?? 0);
      }
      for (const it of (p.items ?? [])) {
        lines += 1;
        if (it.cargo_status === "arrived") arrived += 1;
        else pending += 1;
      }
    }
    return { ksDirect, thbBought, thbInKs, grandKs: ksDirect + thbInKs, count, lines, arrived, pending };
  }, [pos]);

  const reset = () => {
    setSupplierId(""); setOrderedAt(new Date().toISOString().slice(0, 10));
    setNote(""); setItems([]); setCurrency("THB"); setRate(0);
  };

  const save = async () => {
    if (items.length === 0) return toast.error("Add at least one item");
    if (currency === "THB" && rate <= 0) return toast.error("Exchange rate required");
    const supplier = suppliers.find(s => s.id === supplierId);

    const { data: po, error } = await supabase.from("purchase_orders").insert({
      supplier_id: supplierId || null,
      supplier_name: supplier?.name ?? null,
      ordered_at: orderedAt,
      note,
      total: totals.ks,
      thb_total: totals.thb,
      currency,
      exchange_rate: currency === "THB" ? rate : null,
      status: "pending",
    }).select().single();
    if (error || !po) return toast.error(error?.message ?? "Failed");

    const rows = items.map(i => {
      const uc = unitCostKS(i, rate, currency);
      return {
        po_id: po.id,
        product_id: i.product_id || null,
        product_name: i.product_name,
        variant: i.variant || null,
        quantity: i.quantity,
        unit_cost: uc,
        line_total: i.quantity * uc,
        thb_price: i.thb_price ?? null,
        tracking_code: i.tracking_code || null,
        cargo_status: i.cargo_status,
      };
    });
    const { error: itErr } = await supabase.from("purchase_order_items").insert(rows);
    if (itErr) return toast.error(itErr.message);
    toast.success("PO created");
    setOpen(false); reset();
    qc.invalidateQueries({ queryKey: ["purchase_orders"] });
  };

  const receive = async (id: string) => {
    if (!confirm("Mark all items as arrived & add stock to products?")) return;
    const { data: po } = await supabase.from("purchase_orders").select("*, items:purchase_order_items(*)").eq("id", id).single();
    if (!po) return;
    for (const it of (po as any).items ?? []) {
      if (!it.product_id) continue;
      const { data: p } = await supabase.from("products").select("stock_in").eq("id", it.product_id).single();
      if (p) await supabase.from("products").update({ stock_in: (p.stock_in ?? 0) + it.quantity }).eq("id", it.product_id);
    }
    await supabase.from("purchase_order_items").update({ cargo_status: "arrived" }).eq("po_id", id);
    await supabase.from("purchase_orders").update({ status: "received", received_at: new Date().toISOString().slice(0, 10) }).eq("id", id);
    toast.success("Stock updated");
    qc.invalidateQueries({ queryKey: ["purchase_orders"] });
  };

  const updateLineStatus = async (lineId: string, status: Item["cargo_status"]) => {
    await supabase.from("purchase_order_items").update({ cargo_status: status }).eq("id", lineId);
    qc.invalidateQueries({ queryKey: ["purchase_orders"] });
  };

  const cargoBadge = (s: string) => {
    const map: Record<string, string> = {
      ordered: "bg-amber-500/15 text-amber-600",
      in_transit: "bg-blue-500/15 text-blue-600",
      arrived: "bg-green-500/15 text-green-600",
    };
    return <Badge variant="outline" className={map[s] ?? ""}>{s.replace("_", " ")}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Manage incoming stock from suppliers</p>
        <div className="flex flex-wrap gap-2">
          <Input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="w-[160px]" />
          <Button variant="outline" asChild><Link to="/suppliers">Suppliers</Link></Button>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />New PO</Button></DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>New Purchase Order</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="space-y-1.5 col-span-2"><Label>Supplier</Label>
                    <Select value={supplierId} onValueChange={setSupplierId}>
                      <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                      <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5"><Label>Ordered Date</Label><Input type="date" value={orderedAt} onChange={e => setOrderedAt(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Currency</Label>
                    <Select value={currency} onValueChange={(v) => setCurrency(v as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="THB">THB (฿)</SelectItem>
                        <SelectItem value="KS">KS (Direct)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {currency === "THB" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Exchange Rate (1 THB = ? KS)</Label>
                      <Input type="number" value={rate || ""} onChange={e => setRate(Number(e.target.value))} placeholder="e.g. 145" />
                    </div>
                    <div className="space-y-1.5"><Label>Note</Label><Input value={note} onChange={e => setNote(e.target.value)} /></div>
                  </div>
                )}
                {currency === "KS" && (
                  <div className="space-y-1.5"><Label>Note</Label><Input value={note} onChange={e => setNote(e.target.value)} /></div>
                )}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Items</Label>
                    <Button size="sm" variant="outline" onClick={() => setItems([...items, { product_name: "", quantity: 1, cargo_status: "ordered" }])}>+ Add</Button>
                  </div>
                  {items.map((it, idx) => {
                    const uc = unitCostKS(it, rate, currency);
                    return (
                      <div key={idx} className="space-y-2 rounded-md border p-2">
                        <div className="grid grid-cols-12 gap-2">
                          <Select value={it.product_id ?? ""} onValueChange={(v) => {
                            const p = products.find(x => x.id === v);
                            const next = [...items]; next[idx] = { ...it, product_id: v, product_name: p?.name ?? it.product_name };
                            setItems(next);
                          }}>
                            <SelectTrigger className="col-span-7"><SelectValue placeholder="Product" /></SelectTrigger>
                            <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                          </Select>
                          <Input className="col-span-3" placeholder="Variant/Color" value={it.variant ?? ""} onChange={e => { const n = [...items]; n[idx] = { ...it, variant: e.target.value }; setItems(n); }} />
                          <Input className="col-span-1" type="number" placeholder="Qty" value={it.quantity} onChange={e => { const n = [...items]; n[idx] = { ...it, quantity: Number(e.target.value) }; setItems(n); }} />
                          <Button className="col-span-1" size