import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Search,
  Eye,
  Phone,
  MapPin,
  Users,
  ShoppingBag,
} from "lucide-react";
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

const normalizeDigits = (value: string) =>
  value.replace(/[၀-၉]/g, (digit) => String("၀၁၂၃၄၅၆၇၈၉".indexOf(digit)));

function parseCustomerPaste(raw: string): Partial<Customer> {
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const parsed: Partial<Customer> = {};
  const remaining: string[] = [];

  for (const line of lines) {
    const match = line.match(/^([^:：]+)\s*[:：]\s*(.+)$/);
    if (match) {
      const label = match[1].trim().toLowerCase();
      const value = match[2].trim();
      if (/^(name|customer|အမည်|နာမည်)$/.test(label)) parsed.name = value;
      else if (/^(phone|mobile|ဖုန်း|ဖုန်းနံပါတ်)$/.test(label)) parsed.phone = value;
      else if (/^(second phone|phone 2|ဖုန်း ၂)$/.test(label)) parsed.phone_2 = value;
      else if (/^(address|လိပ်စာ)$/.test(label)) parsed.address = value;
      else if (/^(city|township|မြို့|မြို့နယ်)$/.test(label)) parsed.city = value;
      else if (/^(region|state|တိုင်း|ပြည်နယ်)$/.test(label)) parsed.region = value;
      else if (/^(note|မှတ်ချက်)$/.test(label)) parsed.note = value;
      else remaining.push(line);
      continue;
    }

    const digits = normalizeDigits(line).replace(/[^0-9]/g, "");
    const looksLikePhone = digits.length >= 9 && digits.length <= 13 &&
      /^(?:09|959|95|9)/.test(digits);
    if (!parsed.phone && looksLikePhone) parsed.phone = line;
    else remaining.push(line);
  }

  if (!parsed.name && remaining.length) parsed.name = remaining.shift();
  if (!parsed.address && remaining.length) parsed.address = remaining.join(", ");
  return parsed;
}


function CustomersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Customer>>(empty);
  const [saving, setSaving] = useState(false);
  const [bulkCustomerText, setBulkCustomerText] = useState("");

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

  const regions = [...new Set(customers.map((c) => c.region?.trim()).filter((v): v is string => Boolean(v)))].sort((a, b) => a.localeCompare(b));
  const filtered = customers.filter((c) => {
    const matchesSearch = [c.name, c.phone, c.phone_2, c.address, c.city, c.region]
      .filter(Boolean).join(" ").toLowerCase().includes(search.trim().toLowerCase());
    const matchesRegion = regionFilter === "all" || c.region?.trim() === regionFilter;
    return matchesSearch && matchesRegion;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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

  const getStats = (customer: Customer) =>
    (customer.phone ? (orderStats as Record<string, { count: number; total: number }>)[customer.phone] : null) ??
    (customer.phone_2 ? (orderStats as Record<string, { count: number; total: number }>)[customer.phone_2] : null);

  const addressText = (customer: Customer) =>
    [customer.address, customer.city, customer.region].filter(Boolean).join(", ");

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold tracking-tight">Customers</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "customer" : "customers"}
            {search || regionFilter !== "all" ? " found" : " registered"}
          </p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) { setForm({ ...empty }); setBulkCustomerText(""); }
          }}
        >
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto" onClick={() => { setForm({ ...empty }); setBulkCustomerText(""); }}>
              <Plus className="mr-2 h-4 w-4" />
              Add Customer
            </Button>
          </DialogTrigger>
          <DialogContent className="top-4 max-h-[calc(100dvh-2rem)] translate-y-0 overflow-y-auto sm:top-[50%] sm:max-h-[90vh] sm:translate-y-[-50%]">
            <DialogHeader>
              <DialogTitle>{form.id ? "Edit" : "New"} Customer</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2 rounded-lg border border-dashed p-3">
                <div>
                  <Label>Paste customer details (optional)</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Paste name, phone number and address on separate lines. You can still edit every field manually below.
                  </p>
                </div>
                <Textarea
                  value={bulkCustomerText}
                  onChange={(e) => setBulkCustomerText(e.target.value)}
                  placeholder={"ယဉ်နွယ်သင်း\n09253518992\n331, လေယာဉ်ကွင်းလမ်း၊ ဝဲကျွန်းရပ်၊ ထားဝယ်မြို့"}
                  rows={3}
                  aria-label="Paste customer details"
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  disabled={!bulkCustomerText.trim()}
                  onClick={() => {
                    const parsed = parseCustomerPaste(bulkCustomerText);
                    if (!Object.values(parsed).some(Boolean)) {
                      toast.error("Could not recognize customer details. Enter them manually.");
                      return;
                    }
                    setForm((current) => ({ ...current, ...parsed }));
                    toast.success("Customer details filled in. Please review before saving.");
                  }}
                >
                  Auto-fill fields
                </Button>
              </div>
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
                <Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Address</Label>
                <Textarea value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
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
                <Textarea value={form.note ?? ""} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {saving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative w-full">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search name, phone number or address…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="h-11 w-full pl-9"
          aria-label="Search customers"
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="shrink-0">Region</span>
          <select value={regionFilter} onChange={(e) => { setRegionFilter(e.target.value); setPage(1); }}
            className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm text-foreground sm:max-w-xs"
            aria-label="Filter customers by region">
            <option value="all">All regions</option>
            {regions.map((region) => <option key={region} value={region}>{region}</option>)}
          </select>
        </label>
        <p className="text-xs text-muted-foreground">Showing {filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} of {filtered.length}</p>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
            <Users className="h-9 w-9 text-muted-foreground/60" />
            <p className="font-medium">No customers found</p>
            <p className="text-sm text-muted-foreground">
              {search ? "Try another name, phone number or address." : "Add your first customer to get started."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid min-w-0 grid-cols-1 gap-3 md:hidden">
            {paginated.map((customer) => {
              const stat = getStats(customer);
              const address = addressText(customer);
              return (
                <Card key={customer.id} className="min-w-0 overflow-hidden shadow-sm">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-base font-semibold leading-6 [overflow-wrap:anywhere]">
                          {customer.name}
                        </p>
                        {customer.note && (
                          <p className="mt-1 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
                            {customer.note}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                        Customer
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex min-w-0 items-start gap-2 text-sm">
                        <Phone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="break-all font-medium tabular-nums">{customer.phone || "No phone number"}</p>
                          {customer.phone_2 && (
                            <p className="mt-1 break-all text-xs text-muted-foreground tabular-nums">
                              {customer.phone_2}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex min-w-0 items-start gap-2 text-sm">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <p className="min-w-0 flex-1 whitespace-normal break-words leading-6 text-muted-foreground [overflow-wrap:anywhere]">
                          {address || "No address provided"}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/40 p-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <ShoppingBag className="h-3.5 w-3.5" />
                          Orders
                        </div>
                        <p className="mt-1 text-base font-semibold tabular-nums">{stat?.count ?? 0}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Total Spent</p>
                        <p className="mt-1 break-words text-base font-semibold tabular-nums [overflow-wrap:anywhere]">
                          {formatKS(stat?.total ?? 0)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 border-t pt-3">
                      <Button size="sm" variant="outline" className="min-w-0 flex-1" asChild>
                        <Link to="/customers/$id" params={{ id: customer.id }}>
                          <Eye className="mr-1.5 h-4 w-4" /> View
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-w-0 flex-1"
                        onClick={() => {
                          setForm(customer);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="mr-1.5 h-4 w-4" /> Edit
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="shrink-0 text-destructive hover:text-destructive"
                        aria-label={`Delete ${customer.name}`}
                        onClick={() => remove(customer.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="hidden overflow-hidden md:block">
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full table-fixed text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="w-[19%] px-4 py-3">Name</th>
                    <th className="w-[17%] px-3 py-3">Phone</th>
                    <th className="w-[31%] px-3 py-3">Address</th>
                    <th className="w-[9%] px-3 py-3">Orders</th>
                    <th className="w-[14%] px-3 py-3">Total Spent</th>
                    <th className="w-[10%] px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((customer) => {
                    const stat = getStats(customer);
                    const address = addressText(customer);
                    return (
                      <tr key={customer.id} className="border-t align-top hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium">
                          <p className="break-words [overflow-wrap:anywhere]">{customer.name}</p>
                          {customer.note && (
                            <p className="mt-1 break-words text-xs font-normal text-muted-foreground [overflow-wrap:anywhere]">
                              {customer.note}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <p className="break-all tabular-nums">{customer.phone || "—"}</p>
                          {customer.phone_2 && (
                            <p className="mt-1 break-all text-xs text-muted-foreground tabular-nums">{customer.phone_2}</p>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <p className="whitespace-normal break-words leading-6 text-muted-foreground [overflow-wrap:anywhere]">
                            {address || "—"}
                          </p>
                        </td>
                        <td className="px-3 py-3 tabular-nums">{stat?.count ?? 0}</td>
                        <td className="px-3 py-3 font-medium tabular-nums">{formatKS(stat?.total ?? 0)}</td>
                        <td className="px-3 py-3">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" aria-label={`View ${customer.name}`} asChild>
                              <Link to="/customers/$id" params={{ id: customer.id }}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`Edit ${customer.name}`}
                              onClick={() => {
                                setForm(customer);
                                setOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`Delete ${customer.name}`}
                              className="text-destructive hover:text-destructive"
                              onClick={() => remove(customer.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 border-t pt-3">
              <p className="text-xs text-muted-foreground">Page {currentPage} of {totalPages}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
                <Button size="sm" variant="outline" disabled={currentPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
