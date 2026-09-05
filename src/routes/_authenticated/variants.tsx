import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Save, Plus, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/variants")({ component: BulkVariantsPage });

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
  _dirty?: boolean;
  _new?: boolean;
};
type Product = { id: string; name: string };

function BulkVariantsPage() {
  const qc = useQueryClient();
  const [productId, setProductId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Variant[]>([]);

  const { data: products = [] } = useQuery({
    queryKey: ["products-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name").order("name");
      if (error) throw error;
      return data as Product[];
    },
  });

  const { data: variants = [] } = useQuery({
    queryKey: ["variants", productId],
    queryFn: async () => {
      if (!productId) return [];
      const { data, error } = await supabase
        .from("product_variants")
        .select("*")
        .eq("product_id", productId)
        .order("created_at");
      if (error) throw error;
      return data as Variant[];
    },
    enabled: !!productId,
  });

  useEffect(() => {
    setRows(variants);
  }, [variants]);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          !search ||
          [r.name, r.size, r.color, r.variant_code]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [rows, search],
  );

  const update = (id: string, patch: Partial<Variant>) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch, _dirty: true } : r)));
  };

  const addRow = () => {
    if (!productId) return toast.error("Select a product first");
    const tmpId = "new-" + Math.random().toString(36).slice(2);
    setRows((rs) => [
      ...rs,
      {
        id: tmpId,
        product_id: productId,
        name: "New variant",
        size: "",
        color: "",
        price: 0,
        stock_in: 0,
        sold_qty: 0,
        status: "ACTIVE",
        variant_code: "",
        _dirty: true,
        _new: true,
      },
    ]);
  };

  const removeRow = async (id: string) => {
    const r = rows.find((x) => x.id === id);
    if (!r) return;
    if (r._new) {
      setRows((rs) => rs.filter((x) => x.id !== id));
      return;
    }
    if (!confirm("Delete this variant?")) return;
    const { error } = await supabase.from("product_variants").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["variants", productId] });
    toast.success("Deleted");
  };

  const saveAll = async () => {
    const dirty = rows.filter((r) => r._dirty);
    if (dirty.length === 0) return toast.info("Nothing to save");
    try {
      for (const r of dirty) {
        const { _dirty, _new, id, ...payload } = r;
        if (_new) {
          const { error } = await supabase.from("product_variants").insert(payload);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("product_variants").update(payload).eq("id", id);
          if (error) throw error;
        }
      }
      toast.success(`${dirty.length} saved`);
      qc.invalidateQueries({ queryKey: ["variants", productId] });
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    }
  };

  const dirtyCount = rows.filter((r) => r._dirty).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-[220px] flex-1 space-y-1.5">
            <label className="text-xs text-muted-foreground">Product</label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger>
                <SelectValue placeholder="Select product…" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {productId && (
            <>
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filter rows…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button variant="outline" onClick={addRow}>
                <Plus className="mr-2 h-4 w-4" />
                Add row
              </Button>
              <Button onClick={saveAll} disabled={dirtyCount === 0}>
                <Save className="mr-2 h-4 w-4" />
                Save {dirtyCount > 0 && `(${dirtyCount})`}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {!productId ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            Select a product to edit its variants in bulk.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Variants ({filtered.length})</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-2 py-3">Name</th>
                  <th>Size</th>
                  <th>Color</th>
                  <th>Code</th>
                  <th>Price (KS)</th>
                  <th>Stock In</th>
                  <th>Sold</th>
                  <th>Status</th>
                  <th className="px-2 text-right">×</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                      No variants. Click "Add row".
                    </td>
                  </tr>
                )}
                {filtered.map((r) => (
                  <tr key={r.id} className={`border-t ${r._dirty ? "bg-amber-500/5" : ""}`}>
                    <td className="px-2 py-1">
                      <Input
                        value={r.name}
                        onChange={(e) => update(r.id, { name: e.target.value })}
                        className="h-8"
                      />
                    </td>
                    <td>
                      <Input
                        value={r.size ?? ""}
                        onChange={(e) => update(r.id, { size: e.target.value })}
                        className="h-8 w-20"
                      />
                    </td>
                    <td>
                      <Input
                        value={r.color ?? ""}
                        onChange={(e) => update(r.id, { color: e.target.value })}
                        className="h-8 w-24"
                      />
                    </td>
                    <td>
                      <Input
                        value={r.variant_code ?? ""}
                        onChange={(e) => update(r.id, { variant_code: e.target.value })}
                        className="h-8 w-24"
                      />
                    </td>
                    <td>
                      <Input
                        type="number"
                        value={r.price}
                        onChange={(e) => update(r.id, { price: Number(e.target.value) })}
                        className="h-8 w-24"
                      />
                    </td>
                    <td>
                      <Input
                        type="number"
                        value={r.stock_in}
                        onChange={(e) => update(r.id, { stock_in: Number(e.target.value) })}
                        className="h-8 w-20"
                      />
                    </td>
                    <td>
                      <Input
                        type="number"
                        value={r.sold_qty}
                        onChange={(e) => update(r.id, { sold_qty: Number(e.target.value) })}
                        className="h-8 w-20"
                      />
                    </td>
                    <td>
                      <Select value={r.status} onValueChange={(v) => update(r.id, { status: v })}>
                        <SelectTrigger className="h-8 w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ACTIVE">Active</SelectItem>
                          <SelectItem value="INACTIVE">Inactive</SelectItem>
                          <SelectItem value="OUT">Out</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-2 text-right">
                      <Button size="icon" variant="ghost" onClick={() => removeRow(r.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
