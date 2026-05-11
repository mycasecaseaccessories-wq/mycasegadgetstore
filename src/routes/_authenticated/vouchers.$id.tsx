import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Save, Printer, ArrowLeft, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatKS } from "@/lib/format";
import { printThermalReceipt } from "@/lib/print-receipt";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/vouchers/$id")({ component: VoucherDetailPage });

type Item = { product_name: string; unit_price: number; quantity: number };
type Voucher = {
  id: string; voucher_no: number; customer_name: string | null; customer_phone: string | null;
  items: Item[]; subtotal: number; discount: number; extra_fee: number; total: number;
  paid: number; payment_method: string | null; note: string | null; issued_at: string;
};

function VoucherDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: voucher } = useQuery({
    queryKey: ["voucher", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("vouchers").select("*").eq("id", id).single();
      if (error) throw error;
      return data as unknown as Voucher;
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data } = await supabase.from("settings").select("*").limit(1).maybeSingle();
      return data;
    },
  });

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [discount, setDiscount] = useState(0);
  const [extra, setExtra] = useState(0);
  const [paid, setPaid] = useState(0);
  const [method, setMethod] = useState<string | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!voucher) return;
    setName(voucher.customer_name ?? "");
    setPhone(voucher.customer_phone ?? "");
    setItems(Array.isArray(voucher.items) ? voucher.items : []);
    setDiscount(Number(voucher.discount));
    setExtra(Number(voucher.extra_fee));
    setPaid(Number(voucher.paid));
    setMethod(voucher.payment_method);
    setNote(voucher.note ?? "");
  }, [voucher]);

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.unit_price * i.quantity, 0), [items]);
  const total = Math.max(0, subtotal - discount + extra);
  const due = total - paid;

  const save = async () => {
    const { error } = await supabase.from("vouchers").update({
      customer_name: name || null, customer_phone: phone || null,
      items: items as any, subtotal, discount, extra_fee: extra, total,
      paid, payment_method: method, note: note || null,
    }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["voucher", id] });
    qc.invalidateQueries({ queryKey: ["vouchers"] });
  };

  if (!voucher) return <div className="p-6 text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" onClick={() => navigate({ to: "/vouchers" })}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => printThermalReceipt({
            voucher_no: voucher.voucher_no,
            business_name: settings?.business_name,
            logo_url: settings?.logo_url,
            customer_name: name, customer_phone: phone,
            items, subtotal, discount, extra_fee: extra, total, paid,
            payment_method: method, note, issued_at: voucher.issued_at,
          })}>
            <ReceiptText className="mr-2 h-4 w-4" />80mm Receipt
          </Button>
          <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print A4</Button>
          <Button onClick={save}><Save className="mr-2 h-4 w-4" />Save</Button>
        </div>
      </div>

      <Card className="print:shadow-none print:border-0">
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {settings?.logo_url && <img src={settings.logo_url} alt="" className="h-12 w-12 rounded object-contain" />}
              <div>
                <CardTitle>{settings?.business_name || "Voucher"}</CardTitle>
                <p className="text-xs text-muted-foreground">Voucher #{voucher.voucher_no}</p>
              </div>
            </div>
            <span className="text-sm text-muted-foreground">{new Date(voucher.issued_at).toLocaleString()}</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-3 sm:grid-cols-2 print:grid-cols-2">
            <div className="space-y-1.5"><Label>Customer Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Phone</Label><Input value={phone} onChange={e => setPhone(e.target.value)} /></div>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr><th className="px-3 py-2">Item</th><th>Unit</th><th>Qty</th><th>Total</th><th className="print:hidden"></th></tr>
              </thead>
              <tbody>
                {items.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No items</td></tr>}
                {items.map((it, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2"><Input value={it.product_name} onChange={e => setItems(s => s.map((x, j) => j === i ? { ...x, product_name: e.target.value } : x))} /></td>
                    <td><Input type="number" className="w-24" value={it.unit_price} onChange={e => setItems(s => s.map((x, j) => j === i ? { ...x, unit_price: +e.target.value } : x))} /></td>
                    <td><Input type="number" min={1} className="w-20" value={it.quantity} onChange={e => setItems(s => s.map((x, j) => j === i ? { ...x, quantity: Math.max(1, +e.target.value) } : x))} /></td>
                    <td className="font-medium">{formatKS(it.unit_price * it.quantity)}</td>
                    <td className="print:hidden"><Button size="icon" variant="ghost" onClick={() => setItems(s => s.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p-2 print:hidden">
              <Button size="sm" variant="outline" onClick={() => setItems(s => [...s, { product_name: "", unit_price: 0, quantity: 1 }])}><Plus className="mr-2 h-4 w-4" />Add row</Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <div className="space-y-1.5 print:hidden"><Label>Note</Label><Textarea rows={2} value={note} onChange={e => setNote(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3 print:hidden">
                <div className="space-y-1.5"><Label>Discount</Label><Input type="number" value={discount} onChange={e => setDiscount(+e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Extra Fee</Label><Input type="number" value={extra} onChange={e => setExtra(+e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Paid</Label><Input type="number" value={paid} onChange={e => setPaid(+e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Method</Label>
                  <Select value={method ?? ""} onValueChange={v => setMethod(v || null)}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="kpay">KBZ Pay</SelectItem>
                      <SelectItem value="wave">Wave Pay</SelectItem>
                      <SelectItem value="bank">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4 space-y-1.5 text-sm">
              <Row label="Subtotal" value={formatKS(subtotal)} />
              <Row label="Discount" value={`- ${formatKS(discount)}`} />
              <Row label="Extra Fee" value={`+ ${formatKS(extra)}`} />
              <div className="border-t pt-2 mt-1"><Row label="Total" value={formatKS(total)} bold /></div>
              <Row label="Paid" value={formatKS(paid)} />
              <Row label={due > 0 ? "Due" : "Change"} value={formatKS(Math.abs(due))} bold />
              {note && <p className="border-t pt-2 mt-2 text-xs text-muted-foreground italic">{note}</p>}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "text-base font-semibold" : ""}`}>
      <span className="text-muted-foreground">{label}</span><span>{value}</span>
    </div>
  );
}
