import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Trash2, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatKS, formatDateTime } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/purchase-orders")({ component: POPage });

type Item = { product_id?: string | null; product_name: string; quantity: number; unit_cost: number };

function POPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState<string>("");
  const [orderedAt, setOrderedAt] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [items, setItems] = useState<Item[]>([]);

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => (await supabase.from("suppliers").select("id, name").order("name")).data ?? [],
  });
  const { data: products = [] } = useQuery({
    queryKey: ["products-min"],
    queryFn: async () => (await supabase.from("products").select("id, name").order("name")).data ?? [],
  });
  const { data: pos = [] } = useQuery({
    queryKey: ["purchase_orders"],
    queryFn: async () => {
      const { data } = await supabase.from("purchase_orders").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const total = useMemo(() => items.reduce((s, i) => s + i.quantity * i.unit_cost, 0), [items]);

  const reset = () => { setSupplierId(""); setOrderedAt(new Date().toISOString().slice(0, 10)); setNote(""); setItems([]); };

  const save = async () => {
    if (items.length === 0) return toast.error("Add at least one item");
    const supplier = suppliers.find(s => s.id === supplierId);
    const { data: po, error } = await supabase.from("purchase_orders").insert({
      supplier_id: supplierId || null,
      supplier_name: supplier?.name ?? null,
      ordered_at: orderedAt,
      note,
      total,
      status: "pending",
    }).select().single();
    if (error || !po) return toast.error(error?.message ?? "Failed");

    const rows = items.map(i => ({
      po_id: po.id,
      product_id: i.product_id || null,
      product_name: i.product_name,
      quantity: i.quantity,
      unit_cost: i.unit_cost,
      line_total: i.quantity * i.unit_cost,
    }));
    await supabase.from("purchase_order_items").insert(rows);
    toast.success("PO created");
    setOpen(false); reset();
    qc.invalidateQueries({ queryKey: ["purchase_orders"] });
  };

  const receive = async (id: string) => {
    if (!confirm("Mark as received & add stock to products?")) return;
    const { data: po } = await supabase.from("purchase_orders").select("*, items:purchase_order_items(*)").eq("id", id).single();
    if (!po) return;
    for (const it of (po as any).items ?? []) {
      if (!it.product_id) continue;
      const { data: p } = await supabase.from("products").select("stock_in").eq("id", it.product_id).single();
      if (p) await supabase.from("products").update({ stock_in: (p.stock_in ?? 0) + it.quantity }).eq("id", it.product_id);
    }
    await supabase.from("purchase_orders").update({ status: "received", received_at: new Date().toISOString().slice(0, 10) }).eq("id", id);
    toast.success("Stock updated");
    qc.invalidateQueries({ queryKey: ["purchase_orders"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Manage incoming stock from suppliers</p>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link to="/suppliers">Suppliers</Link></Button>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />New PO</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>New Purchase Order</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Supplier</Label>
                    <Select value={supplierId} onValueChange={setSupplierId}>
                      <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                      <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5"><Label>Ordered Date</Label><Input type="date" value={orderedAt} onChange={e => setOrderedAt(e.target.value)} /></div>
                </div>
                <div className="space-y-1.5"><Label>Note</Label><Input value={note} onChange={e => setNote(e.target.value)} /></div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between"><Label>Items</Label><Button size="sm" variant="outline" onClick={() => setItems([...items, { product_name: "", quantity: 1, unit_cost: 0 }])}>+ Add</Button></div>
                  {items.map((it, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2">
                      <Select value={it.product_id ?? ""} onValueChange={(v) => {
                        const p = products.find(x => x.id === v);
                        const next = [...items];
                        next[idx] = { ...it, product_id: v, product_name: p?.name ?? it.product_name };
                        setItems(next);
                      }}>
                        <SelectTrigger className="col-span-5"><SelectValue placeholder="Product" /></SelectTrigger>
                        <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                      </Select>
                      <Input className="col-span-2" type="number" placeholder="Qty" value={it.quantity} onChange={e => { const n = [...items]; n[idx] = { ...it, quantity: Number(e.target.value) }; setItems(n); }} />
                      <Input className="col-span-4" type="number" placeholder="Unit cost" value={it.unit_cost} onChange={e => { const n = [...items]; n[idx] = { ...it, unit_cost: Number(e.target.value) }; setItems(n); }} />
                      <Button className="col-span-1" size="icon" variant="ghost" onClick={() => setItems(items.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end text-sm font-medium">Total: {formatKS(total)}</div>
              </div>
              <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Create</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card><CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-3">PO #</th><th>Supplier</th><th>Ordered</th><th>Status</th><th className="text-right">Total</th><th className="px-4 text-right">Actions</th></tr>
          </thead>
          <tbody>
            {pos.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No purchase orders</td></tr>}
            {pos.map((p: any) => (
              <tr key={p.id} className="border-t">
                <td className="px-4 py-3 font-medium">#{p.po_no}</td>
                <td>{p.supplier_name ?? "—"}</td>
                <td className="text-muted-foreground">{formatDateTime(p.ordered_at)}</td>
                <td><Badge variant="outline" className={p.status === "received" ? "bg-green-500/15 text-green-600" : "bg-amber-500/15 text-amber-600"}>{p.status}</Badge></td>
                <td className="text-right font-medium">{formatKS(Number(p.total))}</td>
                <td className="px-4 text-right">
                  {p.status !== "received" && <Button size="sm" variant="ghost" onClick={() => receive(p.id)}><PackageCheck className="mr-1 h-4 w-4" />Receive</Button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent></Card>
    </div>
  );
}
