import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, Trash2, GripVertical, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/payment-methods")({ component: PaymentMethodsPage });

type PM = {
  id: string;
  provider: string;
  account_name: string;
  account_number: string;
  bank_name: string | null;
  note: string | null;
  qr_url: string | null;
  is_active: boolean;
  sort_order: number;
};

const empty: Partial<PM> = {
  provider: "",
  account_name: "",
  account_number: "",
  bank_name: "",
  note: "",
  qr_url: "",
  is_active: true,
  sort_order: 0,
};

const PRESETS = ["Wave Money", "KBZ Pay", "AYA Pay", "CB Pay", "Binance", "USDT (TRC20)", "Bank Transfer", "Cash on Delivery"];

function PaymentMethodsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<PM> | null>(null);

  const { data: methods = [], isLoading } = useQuery({
    queryKey: ["payment_methods"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_methods")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PM[];
    },
  });

  const openNew = () => { setEditing({ ...empty }); setOpen(true); };
  const openEdit = (m: PM) => { setEditing({ ...m }); setOpen(true); };

  const save = async () => {
    if (!editing) return;
    if (!editing.provider?.trim() || !editing.account_name?.trim() || !editing.account_number?.trim()) {
      return toast.error("Provider, account name & number are required");
    }
    const payload = {
      provider: editing.provider.trim(),
      account_name: editing.account_name.trim(),
      account_number: editing.account_number.trim(),
      bank_name: editing.bank_name?.trim() || null,
      note: editing.note?.trim() || null,
      qr_url: editing.qr_url?.trim() || null,
      is_active: editing.is_active ?? true,
      sort_order: editing.sort_order ?? 0,
    };
    const { error } = editing.id
      ? await supabase.from("payment_methods").update(payload).eq("id", editing.id)
      : await supabase.from("payment_methods").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editing.id ? "Updated" : "Added");
    setOpen(false);
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["payment_methods"] });
  };

  const toggle = async (m: PM) => {
    const { error } = await supabase.from("payment_methods").update({ is_active: !m.is_active }).eq("id", m.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["payment_methods"] });
  };

  const remove = async (m: PM) => {
    if (!confirm(`Delete ${m.provider}?`)) return;
    const { error } = await supabase.from("payment_methods").delete().eq("id", m.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["payment_methods"] });
  };

  const move = async (m: PM, dir: -1 | 1) => {
    const { error } = await supabase.from("payment_methods").update({ sort_order: (m.sort_order ?? 0) + dir }).eq("id", m.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["payment_methods"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payment Methods</h1>
          <p className="text-sm text-muted-foreground">Wave Money, KBZ Pay, AYA Pay, Binance, ဘဏ်အကောင့်များ စသဖြင့် manual payment options</p>
        </div>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Add method</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && methods.length === 0 && (
          <Card><CardContent className="p-6 text-center text-muted-foreground">No payment methods yet. Click <b>Add method</b>.</CardContent></Card>
        )}
        {methods.map((m) => (
          <Card key={m.id} className={m.is_active ? "" : "opacity-60"}>
            <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  {m.provider}
                  {!m.is_active && <Badge variant="outline">Inactive</Badge>}
                </CardTitle>
                {m.bank_name && <p className="text-xs text-muted-foreground">{m.bank_name}</p>}
              </div>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(m, -1)} title="Up"><GripVertical className="h-4 w-4" /></Button>
                <Switch checked={m.is_active} onCheckedChange={() => toggle(m)} />
              </div>
            </CardHeader>
            <CardContent className="space-y-1.5 pt-0 text-sm">
              <p><span className="text-muted-foreground">အကောင့်နာမည်:</span> <b>{m.account_name}</b></p>
              <p><span className="text-muted-foreground">အကောင့်နံပါတ်:</span> <b className="font-mono">{m.account_number}</b></p>
              {m.note && <p className="text-xs text-muted-foreground">{m.note}</p>}
              <div className="flex justify-end gap-1 pt-1">
                <Button size="sm" variant="outline" onClick={() => openEdit(m)}><Pencil className="mr-1 h-3 w-3" />Edit</Button>
                <Button size="sm" variant="outline" onClick={() => remove(m)}><Trash2 className="mr-1 h-3 w-3" />Delete</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit payment method" : "Add payment method"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Provider *</Label>
                <Input
                  value={editing.provider ?? ""}
                  onChange={(e) => setEditing({ ...editing, provider: e.target.value })}
                  placeholder="Wave Money / KBZ Pay / Binance ..."
                  list="provider-presets"
                />
                <datalist id="provider-presets">{PRESETS.map(p => <option key={p} value={p} />)}</datalist>
              </div>
              <div className="space-y-1.5">
                <Label>အကောင့်နာမည် *</Label>
                <Input value={editing.account_name ?? ""} onChange={(e) => setEditing({ ...editing, account_name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>အကောင့်နံပါတ် *</Label>
                <Input value={editing.account_number ?? ""} onChange={(e) => setEditing({ ...editing, account_number: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>ဘဏ်နာမည် (optional)</Label>
                <Input value={editing.bank_name ?? ""} onChange={(e) => setEditing({ ...editing, bank_name: e.target.value })} placeholder="KBZ Bank, AYA Bank ..." />
              </div>
              <div className="space-y-1.5">
                <Label>QR image URL (optional)</Label>
                <Input value={editing.qr_url ?? ""} onChange={(e) => setEditing({ ...editing, qr_url: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Note</Label>
                <Textarea value={editing.note ?? ""} onChange={(e) => setEditing({ ...editing, note: e.target.value })} rows={2} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-2">
                <Label className="m-0">Active</Label>
                <Switch checked={editing.is_active ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}><X className="mr-2 h-4 w-4" />Cancel</Button>
            <Button onClick={save}><Check className="mr-2 h-4 w-4" />Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
