import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, Trash2, Search, Layers, AlertTriangle } from "lucide-react";
import { VariantsDialog } from "@/components/VariantsDialog";
import { ImageUpload } from "@/components/ImageUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatKS } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/products")({ component: ProductsPage });

type Product = {
  id: string; name: string; size: string | null; price: number;
  waiting_time: string | null; stock_status: string; category: string | null; note: string | null;
  image_url: string | null; stock_in: number; sold_qty: number; low_stock_threshold: number;
};

const empty: Partial<Product> = { name: "", size: "", price: 0, waiting_time: "", stock_status: "in_stock", category: "", note: "", image_url: null, stock_in: 0, low_stock_threshold: 5 };

function ProductsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [variantsFor, setVariantsFor] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Product>>(empty);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Product[];
    },
  });

  const filtered = products.filter(p =>
    [p.name, p.size, p.category].filter(Boolean).join(" ").toLowerCase().includes(search.toLowerCase())
  );

  const save = async () => {
    if (!form.name) return toast.error("Name is required");
    const payload = { ...form, price: Number(form.price ?? 0) };
    const { error } = form.id
      ? await supabase.from("products").update(payload).eq("id", form.id)
      : await supabase.from("products").insert(payload as any);
    if (error) return toast.error(error.message);
    toast.success(form.id ? "Updated" : "Created");
    setOpen(false); setForm(empty);
    qc.invalidateQueries({ queryKey: ["products"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["products"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, size, category…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setForm(empty); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setForm(empty)}><Plus className="mr-2 h-4 w-4" />Add Product</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{form.id ? "Edit" : "New"} Product</DialogTitle></DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label className="mb-1.5 block">Image</Label>
                <ImageUpload value={form.image_url} onChange={(url) => setForm({ ...form, image_url: url })} bucket="product-images" size="md" />
              </div>
              <div className="sm:col-span-2 space-y-1.5"><Label>Product Name</Label>
                <Input value={form.name ?? ""} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Diameter / Size</Label>
                <Input value={form.size ?? ""} onChange={e => setForm({ ...form, size: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Price (KS)</Label>
                <Input type="number" value={form.price ?? 0} onChange={e => setForm({ ...form, price: Number(e.target.value) })} /></div>
              <div className="space-y-1.5"><Label>Waiting Time</Label>
                <Input value={form.waiting_time ?? ""} onChange={e => setForm({ ...form, waiting_time: e.target.value })} placeholder="e.g. 3-5 days" /></div>
              <div className="space-y-1.5"><Label>Category</Label>
                <Input value={form.category ?? ""} onChange={e => setForm({ ...form, category: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Stock In</Label>
                <Input type="number" value={form.stock_in ?? 0} onChange={e => setForm({ ...form, stock_in: Number(e.target.value) })} /></div>
              <div className="space-y-1.5"><Label>Low-stock threshold</Label>
                <Input type="number" value={form.low_stock_threshold ?? 5} onChange={e => setForm({ ...form, low_stock_threshold: Number(e.target.value) })} /></div>
              <div className="sm:col-span-2 space-y-1.5"><Label>Stock Status</Label>
                <Select value={form.stock_status ?? "in_stock"} onValueChange={(v) => setForm({ ...form, stock_status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_stock">In stock</SelectItem>
                    <SelectItem value="low_stock">Low stock</SelectItem>
                    <SelectItem value="out_of_stock">Out of stock</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2 space-y-1.5"><Label>Note</Label>
                <Textarea value={form.note ?? ""} onChange={e => setForm({ ...form, note: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card><CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-3">Image</th><th>Name</th><th>Size</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th className="px-4 text-right">Actions</th></tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>}
            {!isLoading && filtered.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No products</td></tr>}
            {filtered.map(p => {
              const remaining = (p.stock_in ?? 0) - (p.sold_qty ?? 0);
              const low = remaining > 0 && remaining <= (p.low_stock_threshold ?? 5);
              return (
                <tr key={p.id} className="border-t">
                  <td className="px-4 py-2">
                    {p.image_url ? <img src={p.image_url} alt={p.name} className="h-12 w-12 rounded object-cover" /> : <div className="h-12 w-12 rounded bg-muted" />}
                  </td>
                  <td className="font-medium">{p.name}{p.note && <p className="text-xs text-muted-foreground">{p.note}</p>}</td>
                  <td>{p.size ?? "—"}</td>
                  <td>{p.category ?? "—"}</td>
                  <td className="font-medium">{formatKS(p.price)}</td>
                  <td className={low ? "font-semibold text-amber-600" : ""}>
                    {remaining}{low && <AlertTriangle className="ml-1 inline h-3 w-3" />}
                  </td>
                  <td><Badge variant="outline" className={p.stock_status === "in_stock" ? "bg-green-500/10 text-green-600" : p.stock_status === "low_stock" ? "bg-amber-500/10 text-amber-600" : "bg-red-500/10 text-red-600"}>{p.stock_status.replace("_", " ")}</Badge></td>
                  <td className="px-4 text-right">
                    <Button size="icon" variant="ghost" title="Variants" onClick={() => setVariantsFor(p)}><Layers className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { setForm(p); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4" /></Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent></Card>

      {variantsFor && (
        <VariantsDialog
          productId={variantsFor.id}
          productName={variantsFor.name}
          open={!!variantsFor}
          onOpenChange={(v) => !v && setVariantsFor(null)}
        />
      )}
    </div>
  );
}
