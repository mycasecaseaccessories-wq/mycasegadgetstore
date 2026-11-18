import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Check, ClipboardPaste, FileUp, Loader2, Trash2 } from "lucide-react";
import { RequireAdmin } from "@/components/RequireAdmin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/imports")({
  component: () => (
    <RequireAdmin>
      <ImportsPage />
    </RequireAdmin>
  ),
});

type ImportKind = "customers" | "sales" | "purchases";
type ParsedRow = Record<string, string>;

const templates: Record<ImportKind, string> = {
  customers: "name\tphone\tphone_2\taddress\tcity\tregion\tnote\nCustomer Name\t09123456789\t\tFull delivery address\tYangon\tYangon Region\t",
  sales: "date\tcustomer_name\tphone\tphone_2\taddress\tcity\tregion\tproduct_name\tquantity\tunit_price\tdeposit\tdelivery_status\ttracking_number\tnote\n2026-11-01\tCustomer Name\t09123456789\t\tFull delivery address\tYangon\tYangon Region\tProduct Name\t1\t150000\t50000\tPREPARING\t\t",
  purchases: "ordered_at\tsupplier_name\tproduct_name\tquantity\tunit_cost\ttracking_code\tcargo_status\tnote\n2026-11-01\tSupplier Name\tProduct Name\t1\t50000\tTH123456789\tordered\t",
};

const headers: Record<ImportKind, string[]> = {
  customers: ["name", "phone", "phone_2", "address", "city", "region", "note"],
  sales: ["date", "customer_name", "phone", "phone_2", "address", "city", "region", "product_name", "quantity", "unit_price", "deposit", "delivery_status", "tracking_number", "note"],
  purchases: ["ordered_at", "supplier_name", "product_name", "quantity", "unit_cost", "tracking_code", "cargo_status", "note"],
};

function splitDelimitedLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      values.push(value.trim());
      value = "";
    } else {
      value += char;
    }
  }
  values.push(value.trim());
  return values;
}

function parseTable(text: string, kind: ImportKind): { rows: ParsedRow[]; error: string | null } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return { rows: [], error: "Add a header row and at least one data row." };
  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const columns = splitDelimitedLine(lines[0], delimiter).map((v) => v.trim().toLowerCase());
  const required = kind === "customers" ? ["name"] : kind === "sales" ? ["customer_name", "product_name", "unit_price"] : ["supplier_name", "product_name"];
  const missing = required.filter((key) => !columns.includes(key));
  if (missing.length) return { rows: [], error: `Missing required columns: ${missing.join(", ")}` };
  const rows = lines.slice(1).map((line) => {
    const values = splitDelimitedLine(line, delimiter);
    return Object.fromEntries(columns.map((column, index) => [column, values[index] ?? ""]));
  });
  return { rows, error: null };
}

function numberValue(value: string | undefined, fallback = 0) {
  const n = Number(String(value ?? "").replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

function validDate(value: string | undefined) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : new Date().toISOString().slice(0, 10);
}

function ImportsPage() {
  const qc = useQueryClient();
  const [kind, setKind] = useState<ImportKind>("customers");
  const [text, setText] = useState(templates.customers);
  const [saving, setSaving] = useState(false);
  const parsed = useMemo(() => parseTable(text, kind), [text, kind]);
  const { data: products = [] } = useQuery({
    queryKey: ["import-products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: kind !== "customers",
  });

  const changeKind = (next: ImportKind) => {
    setKind(next);
    setText(templates[next]);
  };

  const save = async () => {
    if (parsed.error || !parsed.rows.length) return toast.error(parsed.error ?? "Nothing to import");
    setSaving(true);
    try {
      if (kind === "customers") await saveCustomers(parsed.rows);
      if (kind === "sales") await saveSales(parsed.rows, products);
      if (kind === "purchases") await savePurchases(parsed.rows, products);
      toast.success(`${parsed.rows.length} ${kind} row(s) imported`);
      setText(templates[kind]);
      await qc.invalidateQueries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Records</p>
        <h2 className="mt-1 text-2xl font-bold">Paste / Import Records</h2>
        <p className="text-sm text-muted-foreground">Import customer, manual sale and purchase rows from Excel or Google Sheets. Use tab-separated values (TSV) for addresses and notes; CSV values in quotes are also supported.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ClipboardPaste className="h-4 w-4 text-primary" />Choose import type</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-sm space-y-1.5"><Label>Record type</Label><Select value={kind} onValueChange={(value) => changeKind(value as ImportKind)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="customers">Customers</SelectItem><SelectItem value="sales">Manual sales</SelectItem><SelectItem value="purchases">Purchase records</SelectItem></SelectContent></Select></div>
          <div className="space-y-1.5"><div className="flex items-center justify-between"><Label>Paste TSV or CSV</Label><Button size="sm" variant="ghost" onClick={() => setText(templates[kind])}><FileUp className="mr-2 h-4 w-4" />Use template</Button></div><Textarea className="min-h-[240px] font-mono text-xs" value={text} onChange={(event) => setText(event.target.value)} spellCheck={false} /></div>
          <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">Required: {kind === "customers" ? "name" : kind === "sales" ? "customer_name, product_name, unit_price" : "supplier_name, product_name"}. Purchase cargo_status: ordered / in_transit / arrived.</p><div className="flex gap-2"><Button variant="outline" onClick={() => setText("")}><Trash2 className="mr-2 h-4 w-4" />Clear</Button><Button onClick={save} disabled={saving || Boolean(parsed.error) || !parsed.rows.length}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Save {parsed.rows.length || 0} rows</Button></div></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle className="text-base">Preview</CardTitle><Badge variant={parsed.error ? "destructive" : "secondary"}>{parsed.error ? "Needs attention" : `${parsed.rows.length} rows`}</Badge></CardHeader>
        <CardContent className="overflow-x-auto p-0">{parsed.error ? <p className="px-4 py-8 text-sm text-destructive">{parsed.error}</p> : <table className="w-full min-w-[900px] text-sm"><thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground"><tr>{headers[kind].map((header) => <th key={header} className="px-3 py-3">{header}</th>)}</tr></thead><tbody>{parsed.rows.slice(0, 25).map((row, index) => <tr key={index} className="border-t">{headers[kind].map((header) => <td key={header} className="max-w-[220px] truncate px-3 py-3">{row[header] || "—"}</td>)}</tr>)}</tbody></table>}</CardContent>
      </Card>
    </div>
  );
}

async function saveCustomers(rows: ParsedRow[]) {
  const values = rows.map((row) => ({ name: row.name?.trim(), phone: row.phone || null, phone_2: row.phone_2 || null, address: row.address || null, city: row.city || null, region: row.region || null, note: row.note || null })).filter((row) => row.name);
  if (!values.length) throw new Error("No customer names found");
  const { error } = await supabase.from("customers").insert(values);
  if (error) throw error;
}

async function saveSales(rows: ParsedRow[], products: { id: string; name: string }[]) {
  for (const row of rows) {
    if (!row.customer_name?.trim() || !row.product_name?.trim()) continue;
    const phone = row.phone?.trim() || null;
    const customerFields = { name: row.customer_name.trim(), phone, phone_2: row.phone_2 || null, address: row.address || null, city: row.city || null, region: row.region || null };
    let customer: { id: string; name: string; phone: string | null } | null = null;
    if (phone) {
      const lookup = await supabase.from("customers").select("id, name, phone").eq("phone", phone).limit(1).maybeSingle();
      if (lookup.error) throw lookup.error;
      customer = lookup.data;
    }
    if (!customer) {
      const created = await supabase.from("customers").insert(customerFields).select("id, name, phone").single();
      if (created.error) throw created.error;
      customer = created.data;
    } else {
      const { error } = await supabase.from("customers").update(customerFields).eq("id", customer.id);
      if (error) throw error;
    }
    const product = products.find((item) => item.name.trim().toLowerCase() === row.product_name.trim().toLowerCase());
    const quantity = Math.max(1, Math.round(numberValue(row.quantity, 1)));
    const unitPrice = Math.max(0, numberValue(row.unit_price));
    if (unitPrice <= 0) throw new Error(`Sale price is missing for ${row.product_name}`);
    const total = unitPrice * quantity;
    const deposit = Math.min(total, Math.max(0, numberValue(row.deposit)));
    const deliveryStatus = (row.delivery_status || "PENDING").toUpperCase();
    const allowedDelivery = ["PENDING", "PREPARING", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELLED", "RETURNED"];
    const { data: order, error: orderError } = await supabase.from("orders").insert({
      customer_id: customer.id,
      customer_name: customer.name,
      customer_phone: customer.phone,
      delivery_note: [row.address, row.city, row.region, row.note].filter(Boolean).join(" · ") || null,
      tracking_number: row.tracking_number || null,
      order_date: validDate(row.date),
      subtotal: total,
      discount: 0,
      extra_fee: 0,
      total,
      order_source: "MANUAL",
      deposit_amount: deposit,
      balance_amount: total - deposit,
      payment_status: deposit >= total ? "paid" : deposit > 0 ? "partial" : "unpaid",
      status: "pending",
      delivery_status: allowedDelivery.includes(deliveryStatus) ? deliveryStatus : "PENDING",
    }).select("id").single();
    if (orderError || !order) throw orderError ?? new Error("Could not create sale");
    const { error: itemError } = await supabase.from("order_items").insert({ order_id: order.id, product_id: product?.id ?? null, product_name: row.product_name.trim(), quantity, unit_price: unitPrice, line_total: total });
    if (itemError) throw itemError;
  }
}

async function savePurchases(rows: ParsedRow[], products: { id: string; name: string }[]) {
  for (const row of rows) {
    if (!row.supplier_name?.trim() || !row.product_name?.trim()) continue;
    const product = products.find((item) => item.name.trim().toLowerCase() === row.product_name.trim().toLowerCase());
    const quantity = Math.max(1, Math.round(numberValue(row.quantity, 1)));
    const unitCost = Math.max(0, numberValue(row.unit_cost));
    const cargoStatus = (row.cargo_status || "ordered").toLowerCase();
    if (!["ordered", "in_transit", "arrived"].includes(cargoStatus)) throw new Error(`Invalid cargo status for ${row.product_name}`);
    const { data: po, error: poError } = await supabase.from("purchase_orders").insert({
      supplier_name: row.supplier_name.trim(),
      status: cargoStatus === "arrived" ? "received" : "pending",
      total: unitCost * quantity,
      ordered_at: validDate(row.ordered_at),
      received_at: cargoStatus === "arrived" ? validDate(row.ordered_at) : null,
      note: row.note || null,
      currency: "KS",
    } as any).select("id").single();
    if (poError || !po) throw poError ?? new Error("Could not create purchase record");
    const { error: itemError } = await supabase.from("purchase_order_items").insert({
      po_id: po.id,
      product_id: product?.id ?? null,
      product_name: row.product_name.trim(),
      quantity,
      unit_cost: unitCost,
      line_total: unitCost * quantity,
      tracking_code: row.tracking_code || null,
      cargo_status,
    } as any);
    if (itemError) {
      await supabase.from("purchase_orders").delete().eq("id", po.id);
      throw itemError;
    }
  }
}
