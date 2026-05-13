import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Trash2, Search, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { formatKS, formatDateTime } from "@/lib/format";
import { awardForPurchase, customerKey } from "@/lib/loyalty";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/orders")({ component: OrdersPage });

const statusList = ["pending", "paid", "processing", "completed", "cancelled"] as const;
const payStatuses = ["unpaid", "partial", "paid", "refunded"] as const;

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-600",
  paid: "bg-blue-500/15 text-blue-600",
  processing: "bg-purple-500/15 text-purple-600",
  completed: "bg-green-500/15 text-green-600",
  cancelled: "bg-red-500/15 text-red-600",
};

type Order = any;

function OrdersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Order | null>(null);
  const [viewing, setViewing] = useState<Order | null>(null);

  const { data: orders = [] } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Order[];
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["order_items", viewing?.id],
    queryFn: async () => {
      if (!viewing) return [];
      const { data, error } = await supabase.from("order_items").select("*").eq("order_id", viewing.id);
      if (error) throw error;
      return data;
    },
    enabled: !!viewing,
  });

  const filtered = orders.filter(o => {
    const matchesSearch = !search ||
      [o.customer_name, o.customer_phone, String(o.order_no)].filter(Boolean).join(" ").toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all" || o.status === filter;
    return matchesSearch && matchesFilter;
  });

  const save = async () => {
    if (!editing) return;
    const original = orders.find(o => o.id === editing.id);
    const { id, order_no, created_at, updated_at, ...payload } = editing;

    // Award points when transitioning to paid/completed (and not already awarded)
    const becomesPaid =
      (editing.payment_status === "paid" || editing.status === "completed") &&
      !(original?.payment_status === "paid" || original?.status === "completed") &&
      Number(editing.points_earned ?? 0) === 0;

    let earned = 0;
    if (becomesPaid) {
      const key = customerKey({ phone: editing.customer_phone, id: editing.customer_id });
      if (key) {
        earned = await awardForPurchase(key, Number(editing.total ?? 0), editing.id, {
          id: editing.customer_id, name: editing.customer_name, phone: editing.customer_phone,
        });
        (payload as any).points_earned = earned;
      }
    }

    const { error } = await supabase.from("orders").update(payload).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(earned > 0 ? `Updated · +${earned} pts awarded` : "Updated");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["orders"] });
    qc.invalidateQueries({ queryKey: ["loyalty_balances"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this order?")) return;
    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["orders"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by customer or phone…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {statusList.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card><CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-3">#</th><th>Customer</th><th>Phone</th><th>Total</th><th>Status</th><th>Payment</th><th>Points</th><th>Date</th><th className="px-4 text-right">Actions</th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">No orders</td></tr>}
            {filtered.map(o => (
              <tr key={o.id} className="border-t">
                <td className="px-4 py-3 font-medium">#{o.order_no}</td>
                <td>{o.customer_name ?? "—"}</td>
                <td className="text-muted-foreground">{o.customer_phone ?? "—"}</td>
                <td className="font-medium">{formatKS(o.total)}</td>
                <td><Badge variant="outline" className={statusColors[o.status]}>{o.status}</Badge></td>
                <td className="text-muted-foreground">{o.payment_status}</td>
                <td className="text-xs">
                  {Number(o.points_earned ?? 0) > 0 && <span className="text-emerald-600">+{o.points_earned}</span>}
                  {Number(o.points_earned ?? 0) > 0 && Number(o.points_redeemed ?? 0) > 0 && " / "}
                  {Number(o.points_redeemed ?? 0) > 0 && <span className="text-amber-600">-{o.points_redeemed}</span>}
                  {!Number(o.points_earned ?? 0) && !Number(o.points_redeemed ?? 0) && <span className="text-muted-foreground">—</span>}
                </td>
                <td className="text-muted-foreground">{formatDateTime(o.created_at)}</td>
                <td className="px-4 text-right">
                  <Button size="icon" variant="ghost" onClick={() => setViewing(o)}><Eye className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditing({ ...o })}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(o.id)}><Trash2 className="h-4 w-4" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent></Card>

      <Dialog open={!!editing} onOpenChange={v => !v && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Order #{editing?.order_no}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Customer Name</Label><Input value={editing.customer_name ?? ""} onChange={e => setEditing({ ...editing, customer_name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Phone</Label><Input value={editing.customer_phone ?? ""} onChange={e => setEditing({ ...editing, customer_phone: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Status</Label>
                <Select value={editing.status} onValueChange={v => setEditing({ ...editing, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{statusList.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Payment</Label>
                <Select value={editing.payment_status} onValueChange={v => setEditing({ ...editing, payment_status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{payStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Discount</Label><Input type="number" value={editing.discount} onChange={e => setEditing({ ...editing, discount: Number(e.target.value), total: Number(editing.subtotal) - Number(e.target.value) + Number(editing.extra_fee) })} /></div>
              <div className="space-y-1.5"><Label>Extra Fee</Label><Input type="number" value={editing.extra_fee} onChange={e => setEditing({ ...editing, extra_fee: Number(e.target.value), total: Number(editing.subtotal) - Number(editing.discount) + Number(e.target.value) })} /></div>
              <div className="sm:col-span-2 space-y-1.5"><Label>Delivery Note</Label><Textarea value={editing.delivery_note ?? ""} onChange={e => setEditing({ ...editing, delivery_note: e.target.value })} /></div>
              <div className="sm:col-span-2 rounded-md bg-muted p-3 text-sm">Total: <span className="font-semibold">{formatKS(editing.total)}</span></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewing} onOpenChange={v => !v && setViewing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Order #{viewing?.order_no}</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Customer:</span> {viewing.customer_name ?? "—"}</div>
                <div><span className="text-muted-foreground">Phone:</span> {viewing.customer_phone ?? "—"}</div>
                <div><span className="text-muted-foreground">Status:</span> {viewing.status}</div>
                <div><span className="text-muted-foreground">Payment:</span> {viewing.payment_status}</div>
              </div>
              <div className="rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                    <tr><th className="px-3 py-2">Item</th><th>Qty</th><th className="text-right">Total</th></tr>
                  </thead>
                  <tbody>
                    {items.map((it: any) => (
                      <tr key={it.id} className="border-t"><td className="px-3 py-2">{it.product_name}</td><td>{it.quantity}</td><td className="text-right">{formatKS(it.line_total)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-1 border-t pt-2">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatKS(viewing.subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>-{formatKS(viewing.discount)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Extra fee</span><span>+{formatKS(viewing.extra_fee)}</span></div>
                {Number(viewing.points_redeemed ?? 0) > 0 && (
                  <div className="flex justify-between text-amber-600"><span>Points redeemed ({viewing.points_redeemed} pts)</span><span>-{formatKS(viewing.points_value)}</span></div>
                )}
                <div className="flex justify-between font-semibold"><span>Total</span><span>{formatKS(viewing.total)}</span></div>
                {Number(viewing.points_earned ?? 0) > 0 && (
                  <div className="flex justify-between text-emerald-600 text-xs pt-1"><span>Points earned</span><span>+{viewing.points_earned} pts</span></div>
                )}
              </div>
              {viewing.delivery_note && <div className="rounded bg-muted p-2 text-xs">{viewing.delivery_note}</div>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
