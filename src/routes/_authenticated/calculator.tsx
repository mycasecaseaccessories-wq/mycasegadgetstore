import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Trash2, Save, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatKS } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/calculator")({ component: CalculatorPage });

type Product = { id: string; name: string; price: number; waiting_time: string | null; size: string | null };
type Line = { product_id: string; product_name: string; unit_price: number; quantity: number };

function CalculatorPage() {
  const navigate = useNavigate();
  const [lines, setLines] = useState<Line[]>([]);
  const [discount, setDiscount] = useState(0);
  const [extra, setExtra] = useState(0);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id,name,price,waiting_time,size").order("name");
      if (error) throw error;
      return data as Product[];
    },
  });

  const addProduct = (id: string) => {
    const p = products.find(x => x.id === id); if (!p) return;
    setLines(ls => [...ls, { product_id: p.id, product_name: p.name + (p.size ? ` (${p.size})` : ""), unit_price: Number(p.price), quantity: 1 }]);
  };

  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.unit_price * l.quantity, 0), [lines]);
  const total = Math.max(0, subtotal - discount + extra);
  const waitingTimes = useMemo(() => {
    const set = new Set<string>();
    for (const l of lines) {
      const p = products.find(p => p.id === l.product_id);
      if (p?.waiting_time) set.add(p.waiting_time);
    }
    return Array.from(set);
  }, [lines, products]);

  const saveOrder = async () => {
    if (lines.length === 0) return toast.error("Add at least one product");
    setSaving(true);
    const { data: order, error } = await supabase.from("orders").insert({
      customer_name: customerName || null,
      customer_phone: customerPhone || null,
      subtotal, discount, extra_fee: extra, total,
      delivery_note: deliveryNote || null,
      status: "pending", payment_status: "unpaid",
    } as any).select("id").single();
    if (error || !order) { setSaving(false); return toast.error(error?.message ?? "Failed"); }
    const items = lines.map(l => ({ ...l, order_id: order.id, line_total: l.unit_price * l.quantity }));
    const { error: e2 } = await supabase.from("order_items").insert(items as any);
    setSaving(false);
    if (e2) return toast.error(e2.message);
    toast.success("Order saved");
    navigate({ to: "/orders" });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle className="text-base">Build Order</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Select onValueChange={addProduct} value="">
              <SelectTrigger className="flex-1"><SelectValue placeholder="Select a product to add…" /></SelectTrigger>
              <SelectContent>
                {products.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}{p.size ? ` · ${p.size}` : ""} — {formatKS(p.price)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr><th className="px-3 py-2">Product</th><th>Unit (KS)</th><th>Qty</th><th>Total</th><th></th></tr>
              </thead>
              <tbody>
                {lines.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">No items yet — add a product above.</td></tr>}
                {lines.map((l, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2 font-medium">{l.product_name}</td>
                    <td><Input type="number" className="w-24" value={l.unit_price} onChange={e => setLines(ls => ls.map((x, j) => j === i ? { ...x, unit_price: Number(e.target.value) } : x))} /></td>
                    <td><Input type="number" min={1} className="w-20" value={l.quantity} onChange={e => setLines(ls => ls.map((x, j) => j === i ? { ...x, quantity: Math.max(1, Number(e.target.value)) } : x))} /></td>
                    <td className="font-medium">{formatKS(l.unit_price * l.quantity)}</td>
                    <td><Button size="icon" variant="ghost" onClick={() => setLines(ls => ls.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Customer Name</Label><Input value={customerName} onChange={e => setCustomerName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Phone</Label><Input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} /></div>
            <div className="sm:col-span-2 space-y-1.5"><Label>Delivery / Pickup Note</Label><Textarea rows={2} value={deliveryNote} onChange={e => setDeliveryNote(e.target.value)} /></div>
          </div>
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader><CardTitle className="text-base">Summary</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Row label="Subtotal" value={formatKS(subtotal)} />
          <div className="space-y-1.5"><Label className="text-xs">Discount (KS)</Label>
            <Input type="number" value={discount} onChange={e => setDiscount(Number(e.target.value))} /></div>
          <div className="space-y-1.5"><Label className="text-xs">Extra Fee (KS)</Label>
            <Input type="number" value={extra} onChange={e => setExtra(Number(e.target.value))} /></div>
          <div className="border-t pt-3"><Row label="Total" value={formatKS(total)} bold /></div>
          {waitingTimes.length > 0 && (
            <div className="rounded-lg bg-muted/50 p-3 text-xs">
              <div className="mb-1 flex items-center gap-1.5 font-medium"><Clock className="h-3.5 w-3.5" />Waiting time</div>
              {waitingTimes.join(" · ")}
            </div>
          )}
          <Button className="w-full" onClick={saveOrder} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />Save as Order
          </Button>
          <Button variant="outline" className="w-full" onClick={() => { setLines([]); setDiscount(0); setExtra(0); }}>
            <Plus className="mr-2 h-4 w-4 rotate-45" />Clear
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between text-sm ${bold ? "text-base font-semibold" : ""}`}>
      <span className="text-muted-foreground">{label}</span><span>{value}</span>
    </div>
  );
}
