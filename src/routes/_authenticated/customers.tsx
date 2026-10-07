import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Plus, Pencil, Trash2, Search, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { formatKS } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/customers")({ component: CustomersPage });

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  phone_2: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  note: string | null;
};
const empty: Partial<Customer> = { name: "", phone: "", phone_2: "", address: "", city: "", region: "", note: "" };

function CustomersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Customer>>(empty);
  const [saving, setSaving] = useState(false);

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Customer[];
    },
  });

  const { data: orderStats = {} } = useQuery({
    queryKey: ["customer-stats"],
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("customer_phone, total, status");
      const map: Record<string, { count: number; total: number }> = {};
      for (const o of data ?? []) {
        if (!o.customer_phone) continue;
        if (!map[o.customer_phone]) map[o.customer_phone] = { count: 0, total: 0 };
        map[o.customer_phone].count++;
        if (o.status !== "cancelled") map[o.customer_phone].total += Number(o.total);
      }
      return map;
    },
  });

  const filtered = customers.filter((c) =>
    [c.name, c.phone, c.address]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  const save = async () => {
    const name = form.name?.trim() ?? "";
    if (!name) return toast.error("Customer name is required");
    const payload = {
      name,
      phone: form.phone?.trim() || null,
      phone_2: form.phone_2?.trim() || null,
      address: form.address?.trim() || null,
      city: form.city?.trim() || null,
      region: form.region?.trim() || null,
      note: form.note?.trim() || null,
    };
    setSaving(true);
    try {
      const request = form.id
        ? supabase.from("customers").update(payload).eq("id", form.id).select("id").single()
        : supabase.from("customers").insert(payload).select("id").single();
      const { error } = await Promise.race([
        request,
        new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("Customer save timed out. Please try again.")), 15000)),
      ]);
      if (error) throw error;
      toast.success(form.id ? "Customer updated" : "Customer saved");
      setOpen(false);
      setForm({ ...empty });
      await qc.invalidateQueries({ queryKey: ["customers"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save customer");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete?")) return;
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["customers"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) setForm(empty);
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={() => setForm(empty)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Customer
            </Button>
          </DialogTrigger>
          <DialogContent className="top-4 max-h-[calc(100dvh-2rem)] translate-y-0 overflow-y-auto sm:top-[50%] sm:max-h-[90vh] sm:translate-y-[-50%]">
            <DialogHeader>
              <DialogTitle>{form.id ? "Edit" : "New"} Customer</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input
                  autoFocus
                  aria-label="Customer name"
                  value={form.name ?? ""}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input
                  value={form.phone ?? ""}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Address</Label>
                <Textarea
                  value={form.address ?? ""}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Second phone (optional)</Label>
                  <Input value={form.phone_2 ?? ""} onChange={(e) => setForm({ ...form, phone_2: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>City / Township</Label>
                  <Input value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Region / State</Label>
                <Input value={form.region ?? ""} onChange={(e) => setForm({ ...form, region: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Note</Label>
                <Textarea
                  value={form.note ?? ""}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {saving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th>Phone</th>
                <th>Address</th>
                <th>Orders</th>
                <th>Total Spent</th>
                <th className="px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No customers
                  </td>
                </tr>
              )}
              {filtered.map((c) => {
                const stat = c.phone ? (orderStats as any)[c.phone] : null;
                return (
                  <tr key={c.id} className="border-t">
                    <td className="px-4 py-3 font-medium">
                      {c.name}
                      {c.note && <p className="text-xs text-muted-foreground">{c.note}</p>}
                    </td>
                    <td>{c.phone ?? "—"}{c.phone_2 && <p className="text-xs text-muted-foreground">{c.phone_2}</p>}</td>
                    <td className="max-w-xs text-muted-foreground">{[c.address, c.city, c.region].filter(Boolean).join(", ") || "—"}</td>
                    <td>{stat?.count ?? 0}</td>
                    <td className="font-medium">{formatKS(stat?.total ?? 0)}</td>
                    <td className="px-4 text-right">
                      <Button size="icon" variant="ghost" asChild>
                        <Link to="/customers/$id" params={{ id: c.id }}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setForm(c);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(c.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
