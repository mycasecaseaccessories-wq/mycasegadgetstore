import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Plus, Save, Search, Trash2, WandSparkles, X } from "lucide-react";
import { ImageUpload } from "@/components/ImageUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatKS } from "@/lib/format";
import { CUSTOM_OPTION, DEFAULT_COLORS, DEFAULT_MODELS, selectValue, uniqueOptions } from "@/lib/catalog-options";

export const Route = createFileRoute("/_authenticated/bulk-variants")({ component: BulkVariantsPage });

type Variant = {
  id: string;
  product_id: string;
  name: string;
  size: string | null;
  color: string | null;
  price: number;
  stock_in: number;
  sold_qty: number;
  status: string;
  variant_code: string | null;
  image_url: string | null;
  _dirty?: boolean;
  _new?: boolean;
};
type Product = { id: string; name: string; price: number; final_sell_mmk: number | null };

type MultiOptionProps = {
  label: string;
  options: string[];
  selected: string[];
  customValue: string;
  onToggle: (value: string) => void;
  onCustomChange: (value: string) => void;
  onAddCustom: () => void;
};

function MultiOptionPicker({ label, options, selected, customValue, onToggle, onCustomChange, onAddCustom }: MultiOptionProps) {
  return (
    <div className="space-y-2 rounded-xl border bg-background/60 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{label}</p>
        <span className="text-xs text-muted-foreground">{selected.length} selected</span>
      </div>
      <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
        {options.map((option) => {
          const active = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => onToggle(option)}
              aria-pressed={active}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted/40 hover:border-primary/50"}`}
            >
              {active && <Check className="h-3 w-3" />}
              {option}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        <Input value={customValue} onChange={(e) => onCustomChange(e.target.value)} placeholder={`Add custom ${label.toLowerCase()}`} className="h-8" />
        <Button type="button" size="sm" variant="outline" onClick={onAddCustom} disabled={!customValue.trim()}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add
        </Button>
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((value) => (
            <button key={value} type="button" onClick={() => onToggle(value)} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
              {value}<X className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function VariantNamePicker({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <div className="min-w-36 space-y-1">
      <Select value={selectValue(value, options)} onValueChange={onChange}>
        <SelectTrigger className="h-8"><SelectValue placeholder="Variant name" /></SelectTrigger>
        <SelectContent>
          {options.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
          <SelectItem value={CUSTOM_OPTION}>Custom name…</SelectItem>
        </SelectContent>
      </Select>
      {(value === CUSTOM_OPTION || (value && !options.includes(value))) && (
        <Input value={value === CUSTOM_OPTION ? "" : value} onChange={(e) => onChange(e.target.value)} className="h-8" placeholder="Custom variant name" autoFocus={value === CUSTOM_OPTION} />
      )}
    </div>
  );
}

function BulkVariantsPage() {
  const qc = useQueryClient();
  const [productId, setProductId] = useState("");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Variant[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [customColor, setCustomColor] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkStock, setBulkStock] = useState("0");
  const [saving, setSaving] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ["products-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name, price, final_sell_mmk").order("name");
      if (error) { toast.error(error.message); return []; }
      return data as Product[];
    },
  });

  const selectedProduct = products.find((product) => product.id === productId);
  const productBasePrice = Number(selectedProduct?.final_sell_mmk ?? selectedProduct?.price ?? 0);

  const { data: variants = [] } = useQuery({
    queryKey: ["variants", productId],
    queryFn: async () => {
      if (!productId) return [];
      const { data, error } = await supabase.from("product_variants").select("*").eq("product_id", productId).order("created_at");
      if (error) { toast.error(error.message); return []; }
      return data as Variant[];
    },
    enabled: !!productId,
  });

  const { data: catalogVariants = [] } = useQuery({
    queryKey: ["catalog-variant-options"],
    queryFn: async () => {
      const { data, error } = await supabase.from("product_variants").select("color, size").limit(5000);
      if (error) throw error;
      return data as Array<{ color: string | null; size: string | null }>;
    },
  });

  useEffect(() => setRows(variants), [variants]);
  useEffect(() => {
    if (productId) setBulkPrice(productBasePrice ? String(productBasePrice) : "");
    setSelectedColors([]); setSelectedModels([]); setCustomColor(""); setCustomModel("");
  }, [productId, productBasePrice]);

  const filtered = useMemo(() => rows.filter((row) => !search || [row.name, row.size, row.color, row.variant_code].filter(Boolean).join(" ").toLowerCase().includes(search.toLowerCase())), [rows, search]);
  const colorOptions = uniqueOptions(DEFAULT_COLORS, catalogVariants.map((row) => row.color), rows.map((row) => row.color));
  const modelOptions = uniqueOptions(DEFAULT_MODELS, catalogVariants.map((row) => row.size), rows.map((row) => row.size));
  const nameOptions = uniqueOptions(selectedProduct ? [selectedProduct.name] : [], rows.map((row) => row.name));
  const dirtyCount = rows.filter((row) => row._dirty).length;

  const update = (id: string, patch: Partial<Variant>) => setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch, _dirty: true } : row));
  const toggle = (value: string, current: string[], set: (values: string[]) => void) => set(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  const addCustom = (value: string, selected: string[], setSelected: (values: string[]) => void, clear: (value: string) => void) => {
    const clean = value.trim();
    if (!clean) return;
    setSelected(selected.includes(clean) ? selected : [...selected, clean]);
    clear("");
  };

  const addRow = () => {
    if (!productId) return toast.error("Select a product first");
    const id = `new-${Math.random().toString(36).slice(2)}`;
    setRows((current) => [...current, { id, product_id: productId, name: selectedProduct?.name ?? "New variant", size: "", color: "", price: productBasePrice, stock_in: 0, sold_qty: 0, status: "ACTIVE", variant_code: "", image_url: null, _dirty: true, _new: true }]);
  };

  const removeRow = async (id: string) => {
    const row = rows.find((item) => item.id === id);
    if (!row) return;
    if (row._new) return setRows((current) => current.filter((item) => item.id !== id));
    if (!confirm("Delete this variant?")) return;
    const { error } = await supabase.from("product_variants").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["variants", productId] });
    toast.success("Deleted");
  };

  const saveAll = async () => {
    const dirty = rows.filter((row) => row._dirty);
    if (!dirty.length) return toast.info("Nothing to save");
    if (dirty.some((row) => !row.name.trim() || !Number.isInteger(row.price) || row.price < 0 || !Number.isInteger(row.stock_in) || row.stock_in < 0 || !Number.isInteger(row.sold_qty) || row.sold_qty < 0)) return toast.error("Every variant needs a valid whole-number price, stock, and sold quantity");
    setSaving(true);
    try {
      for (const row of dirty) {
        const { _dirty, _new, id, ...payload } = row;
        const request = _new ? supabase.from("product_variants").insert(payload) : supabase.from("product_variants").update(payload).eq("id", id);
        const { error } = await Promise.race([request, new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("Variant save timed out. Please try again.")), 15000))]);
        if (error) throw error;
      }
      toast.success(`${dirty.length} variant${dirty.length === 1 ? "" : "s"} saved`);
      await qc.invalidateQueries({ queryKey: ["variants", productId] });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Save failed"); }
    finally { setSaving(false); }
  };

  const createCombinations = () => {
    if (!productId) return toast.error("Select a product first");
    if (!selectedColors.length && !selectedModels.length) return toast.error("Select at least one color or model");
    const colors = selectedColors.length ? selectedColors : [""];
    const models = selectedModels.length ? selectedModels : [""];
    const price = Math.max(0, Number(bulkPrice || productBasePrice) || 0);
    const stock = Math.max(0, Number(bulkStock) || 0);
    const existing = new Set(rows.map((row) => `${row.color ?? ""}|${row.size ?? ""}`));
    const fresh = colors.flatMap((color) => models.map((size) => ({ color: color || null, size: size || null }))).filter((item) => !existing.has(`${item.color ?? ""}|${item.size ?? ""}`));
    if (!fresh.length) return toast.info("Those color/model combinations already exist");
    setRows((current) => [...current, ...fresh.map((item) => ({ id: `new-${Math.random().toString(36).slice(2)}`, product_id: productId, name: selectedProduct?.name ?? "New variant", ...item, price, stock_in: stock, sold_qty: 0, status: "ACTIVE", variant_code: null, image_url: null, _dirty: true, _new: true }))]);
    toast.success(`${fresh.length} draft combination${fresh.length === 1 ? "" : "s"} created. Edit prices if needed, then Save.`);
    setSelectedColors([]); setSelectedModels([]);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><WandSparkles className="h-5 w-5 text-primary" />Bulk Variants</CardTitle><p className="text-sm text-muted-foreground">Select many phone models and colors, create every combination, then set each price and stock before saving.</p></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_auto]">
            <div className="space-y-1.5"><label className="text-xs text-muted-foreground">Product</label><Select value={productId} onValueChange={setProductId}><SelectTrigger><SelectValue placeholder="Select product…" /></SelectTrigger><SelectContent>{products.map((product) => <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>)}</SelectContent></Select></div>
            {selectedProduct && <div className="rounded-xl bg-muted/50 px-4 py-2 text-sm"><p className="text-xs text-muted-foreground">Product default price</p><p className="font-semibold text-primary">{formatKS(productBasePrice)}</p></div>}
          </div>
          {productId && <>
            <div className="grid gap-3 lg:grid-cols-2">
              <MultiOptionPicker label="Colors" options={colorOptions} selected={selectedColors} customValue={customColor} onToggle={(value) => toggle(value, selectedColors, setSelectedColors)} onCustomChange={setCustomColor} onAddCustom={() => addCustom(customColor, selectedColors, setSelectedColors, setCustomColor)} />
              <MultiOptionPicker label="Phone models" options={modelOptions} selected={selectedModels} customValue={customModel} onToggle={(value) => toggle(value, selectedModels, setSelectedModels)} onCustomChange={setCustomModel} onAddCustom={() => addCustom(customModel, selectedModels, setSelectedModels, setCustomModel)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <div className="space-y-1"><label className="text-xs text-muted-foreground">Default variant price (editable per row)</label><Input type="number" min="0" value={bulkPrice} onChange={(e) => setBulkPrice(e.target.value)} placeholder={String(productBasePrice || 0)} /></div>
              <div className="space-y-1"><label className="text-xs text-muted-foreground">Stock for each</label><Input type="number" min="0" value={bulkStock} onChange={(e) => setBulkStock(e.target.value)} /></div>
              <Button type="button" onClick={createCombinations}><WandSparkles className="mr-2 h-4 w-4" />Create combinations</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2"><Search className="h-4 w-4 text-muted-foreground" /><Input className="max-w-sm" placeholder="Filter variants…" value={search} onChange={(e) => setSearch(e.target.value)} /><Button type="button" variant="outline" onClick={addRow}><Plus className="mr-2 h-4 w-4" />Add row</Button><Button type="button" onClick={saveAll} disabled={!dirtyCount || saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{saving ? "Saving…" : `Save ${dirtyCount ? `(${dirtyCount})` : ""}`}</Button></div>
          </>}
        </CardContent>
      </Card>

      {!productId ? <Card><CardContent className="p-12 text-center text-muted-foreground">Select a product above to manage variants.</CardContent></Card> : <Card><CardHeader><CardTitle className="text-base">Variants ({filtered.length})</CardTitle></CardHeader><CardContent className="overflow-x-auto p-0"><table className="w-full text-sm"><thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-2 py-3">Image</th><th>Name</th><th>Model</th><th>Color</th><th>Code</th><th>Price</th><th>Stock</th><th>Sold</th><th>Status</th><th /></tr></thead><tbody>{filtered.length === 0 && <tr><td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">No variants yet.</td></tr>}{filtered.map((row) => <tr key={row.id} className={`border-t ${row._dirty ? "bg-amber-500/5" : ""}`}><td className="px-2 py-1"><ImageUpload value={row.image_url} onChange={(image_url) => update(row.id, { image_url })} bucket="product-images" size="sm" /></td><td className="px-2 py-1"><VariantNamePicker value={row.name} options={nameOptions} onChange={(name) => update(row.id, { name })} /></td><td className="px-1 py-1"><Input value={row.size ?? ""} onChange={(e) => update(row.id, { size: e.target.value })} className="h-8 min-w-28" placeholder="Model" /></td><td className="px-1 py-1"><Input value={row.color ?? ""} onChange={(e) => update(row.id, { color: e.target.value })} className="h-8 min-w-24" placeholder="Color" /></td><td className="px-1 py-1"><Input value={row.variant_code ?? ""} onChange={(e) => update(row.id, { variant_code: e.target.value })} className="h-8 min-w-24" /></td><td className="px-1 py-1"><Input type="number" min="0" value={Number.isFinite(row.price) ? row.price : ""} onChange={(e) => update(row.id, { price: e.target.value === "" ? Number.NaN : Number(e.target.value) })} className="h-8 min-w-24" /></td><td className="px-1 py-1"><Input type="number" min="0" value={Number.isFinite(row.stock_in) ? row.stock_in : ""} onChange={(e) => update(row.id, { stock_in: e.target.value === "" ? Number.NaN : Number(e.target.value) })} className="h-8 min-w-20" /></td><td className="px-1 py-1"><Input type="number" min="0" value={Number.isFinite(row.sold_qty) ? row.sold_qty : ""} onChange={(e) => update(row.id, { sold_qty: e.target.value === "" ? Number.NaN : Number(e.target.value) })} className="h-8 min-w-20" /></td><td className="px-1 py-1"><Select value={row.status} onValueChange={(value) => update(row.id, { status: value })}><SelectTrigger className="h-8 min-w-28"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ACTIVE">Active</SelectItem><SelectItem value="INACTIVE">Inactive</SelectItem><SelectItem value="OUT">Out</SelectItem></SelectContent></Select></td><td className="px-2 text-right"><Button size="icon" variant="ghost" onClick={() => removeRow(row.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></td></tr>)}</tbody></table></CardContent></Card>}
    </div>
  );
}
