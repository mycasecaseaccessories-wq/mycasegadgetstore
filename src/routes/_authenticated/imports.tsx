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

  const { data: existingCustomers = [], isLoading: customersLoading } = useQuery({
    queryKey: ["import-customers"],
    queryFn: async () => {
      const pageSize = 1000;
      const allCustomers: ImportCustomer[] = [];
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await supabase.from("customers")
          .select("id, name, phone, phone_2, address, city, region, note")
          .order("name")
          .range(offset, offset + pageSize - 1);
        if (error) throw error;
        allCustomers.push(...(data ?? []));
        if (!data || data.length < pageSize) break;
      }
      return allCustomers;
    },
    enabled: kind !== "purchases",
  });

  const customerMatch = (row: ParsedRow) => classifyCustomer(row, existingCustomers);
  const possibleDuplicates = kind === "purchases" ? [] : parsed.rows.filter((row) => customerMatch(row).status === "possible");
  const phoneConflicts = kind === "purchases" ? [] : parsed.rows.filter((row) => customerMatch(row).status === "conflict");

  const changeKind = (next: ImportKind) => {
    setKind(next);
    setText(templates[next]);
  };

  const save = async () => {
    if (parsed.error || !parsed.rows.length) return toast.error(parsed.error ?? "Nothing to import");
    if (kind !== "purchases" && customersLoading) return toast.error("Customer records are still loading. Please try again.");
    if (phoneConflicts.length) return toast.error("Some phone numbers match multiple existing customers. Resolve those duplicate records before importing.");
    if (possibleDuplicates.length && !window.confirm(possibleDuplicates.length + " row(s) have the same name and address as an existing customer but no phone number. They may be different people. Create them as separate customers?")) return;
    setSaving(true);
    try {
      if (kind === "customers") await saveCustomers(parsed.rows, existingCustomers);
      if (kind === "sales") await saveSales(parsed.rows, products, existingCustomers);
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
          <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">Required: {kind === "customers" ? "name" : kind === "sales" ? "customer_name, product_name, unit_price" : "supplier_name, product_name"}. Purchase cargo_status: ordered / in_transit / arrived.</p><div className="flex gap-2"><Button variant="outline" onClick={() => setText("")}><Trash2 className="mr-2 h-4 w-4" />Clear</Button><Button onClick={save} disabled={saving || Boolean(parsed.error) || !parsed.rows.length || (kind !== "purchases" && customersLoading)}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Save {parsed.rows.length || 0} rows</Button></div></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle className="text-base">Preview</CardTitle><Badge variant={parsed.error ? "destructive" : "secondary"}>{parsed.error ? "Needs attention" : `${parsed.rows.length} rows`}</Badge></CardHeader>
        <CardContent className="overflow-x-auto p-0">{parsed.error ? <p className="px-4 py-8 text-sm text-destructive">{parsed.error}</p> : <table className="w-full min-w-[900px] text-sm"><thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground"><tr>{headers[kind].map((header) => <th key={header} className="px-3 py-3">{header}</th>)}{kind !== "purchases" && <th className="px-3 py-3">Customer match</th>}</tr></thead><tbody>{parsed.rows.slice(0, 25).map((row, index) => { const match = kind === "purchases" ? null : customerMatch(row); return <tr key={index} className="border-t">{headers[kind].map((header) => <td key={header} className="max-w-[220px] truncate px-3 py-3">{row[header] || "—"}</td>)}{match && <td className="px-3 py-3"><Badge variant={match.status === "conflict" ? "destructive" : match.status === "possible" ? "outline" : "secondary"}>{match.label}</Badge></td>}</tr>})}</tbody></table>}</CardContent>
      </Card>
    </div>
  );
}

type ImportCustomer = {
  id: string;
  name: string;
  phone: string | null;
  phone_2: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  note: string | null;
};

function normalizePhone(value: string | null | undefined): string {
  const myanmarDigits = "၀၁၂၃၄၅၆၇၈၉";
  const englishDigits = "0123456789";
  const translated = String(value ?? "").replace(/[၀-၉]/g, (digit) => englishDigits[myanmarDigits.indexOf(digit)]);
  let digits = translated.replace(/\D/g, "");
  if (digits.startsWith("0095")) digits = digits.slice(2);
  if (digits.startsWith("09")) digits = "959" + digits.slice(2);
  return digits;
}

function normalizeText(value: string | null | undefined): string {
  return String(value ?? "").trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function classifyCustomer(row: ParsedRow, customers: ImportCustomer[]) {
  const incomingPhones = [normalizePhone(row.phone), normalizePhone(row.phone_2)].filter(Boolean);
  if (incomingPhones.length) {
    const matches = customers.filter((customer) =>
      [normalizePhone(customer.phone), normalizePhone(customer.phone_2)].some((phone) => phone && incomingPhones.includes(phone)),
    );
    if (matches.length > 1) return { status: "conflict" as const, label: "Phone conflict" };
    if (matches.length === 1) return { status: "existing" as const, label: "Existing: " + matches[0].name };
    return { status: "new" as const, label: "New customer" };
  }

  const name = normalizeText(row.name ?? row.customer_name);
  const address = normalizeText(row.address);
  if (name && address && customers.some((customer) =>
    normalizeText(customer.name) === name && normalizeText(customer.address) === address,
  )) return { status: "possible" as const, label: "Possible duplicate · confirm" };

  return { status: "new" as const, label: "New customer" };
}

async function resolveImportedCustomer(row: ParsedRow, customers: ImportCustomer[]): Promise<ImportCustomer> {
  const name = (row.name ?? row.customer_name ?? "").trim();
  if (!name) throw new Error("Customer name is required");
  const phone = row.phone?.trim() || null;
  const phone2 = row.phone_2?.trim() || null;
  const incomingPhones = [normalizePhone(phone), normalizePhone(phone2)].filter(Boolean);
  const matches = incomingPhones.length ? customers.filter((customer) =>
    [normalizePhone(customer.phone), normalizePhone(customer.phone_2)].some((value) => value && incomingPhones.includes(value)),
  ) : [];

  if (matches.length > 1) throw new Error("Phone number for " + name + " matches multiple existing customers. Please resolve the duplicate customer records first.");

  if (matches.length === 1) {
    const existing = matches[0];
    const patch: Partial<ImportCustomer> = {};
    if (!existing.name.trim() && name) patch.name = name;
    if (!existing.phone && phone) patch.phone = phone;
    if (!existing.phone_2 && phone2) patch.phone_2 = phone2;
    if (!existing.address && row.address?.trim()) patch.address = row.address.trim();
    if (!existing.city && row.city?.trim()) patch.city = row.city.trim();
    if (!existing.region && row.region?.trim()) patch.region = row.region.trim();
    if (!existing.note && row.note?.trim()) patch.note = row.note.trim();
    if (Object.keys(patch).length) {
      const { error } = await supabase.from("customers").update(patch).eq("id", existing.id);
      if (error) throw error;
      Object.assign(existing, patch);
    }
    return existing;
  }

  const values = {
    name,
    phone,
    phone_2: phone2,
    address: row.address?.trim() || null,
    city: row.city?.trim() || null,
    region: row.region?.trim() || null,
    note: row.note?.trim() || null,
  };
  const { data, error } = await supabase.from("customers").insert(values)
    .select("id, name, phone, phone_2, address, city, region, note").single();
  if (error) throw error;
  customers.push(data);
  return data;
}

async function saveCustomers(rows: ParsedRow[], existingCustomers: ImportCustomer[]) {
  const validRows = rows.filter((row) => row.name?.trim());
  if (!validRows.length) throw new Error("No customer names found");
  for (const row of validRows) await resolveImportedCustomer(row, existingCustomers);
}

async function saveSales(rows: ParsedRow[], products: { id: string; name: string }[], existingCustomers: ImportCustomer[]) {
  for (const row of rows) {
    if (!row.customer_name?.trim() || !row.product_name?.trim()) continue;
    const customer = await resolveImportedCustomer(row, existingCustomers);
    const product = products.find((item) => item.name.trim().toLowerCase() === row.product_name.trim().toLowerCase());
    const quantity = Math.max(1, Math.round(numberValue(row.quantity, 1)));
    const unitPrice = Math.max(0, numberValue(row.unit_price));
    if (unitPrice <= 0) throw new Error("Sale price is missing for " + row.product_name);
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
