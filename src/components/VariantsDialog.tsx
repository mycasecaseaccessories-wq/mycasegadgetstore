import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { formatKS } from "@/lib/format";
import { toast } from "sonner";

type Variant = {
  id: string;
  product_id: string;
  variant_code: string | null;
  name: string;
  size: string | null;
  color: string | null;
  price: number;
  stock_in: number;
  sold_qty: number;
  status: string;
};

const empty = {
  name: "",
  size: "",
  color: "",
  price: 0,
  stock_in: 0,
  status: "ACTIVE",
} as Partial<Variant>;

export function VariantsDialog({
  productId,
  productName,
  open,
  onOpenChange,
}: {
  productId: string;
  productName: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<Variant>>(empty);

  const { data: variants = [] } = useQuery({
    queryKey: ["variants", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_variants")
        .select("*")
        .eq("product_id", productId)
        .order("created_at");
      if (error) throw error;
      return data as Variant[];
    },
    enabled: open,
  });

  const save = async () => {
    if (!form.name) return toast.error("Name required");
    const payload = {
      ...form,
      product_id: productId,
      price: Number(form.price ?? 0),
      stock_in: Number(form.stock_in ?? 0),
    };
    const { error } = form.id
      ? await supabase.from("product_variants").update(payload).eq("id", form.id)
      : await supabase.from("product_variants").insert(payload as any);
    if (error) return toast.error(error.message);
    toast.success(form.id ? "Updated" : "Added");
    setForm(empty);
    qc.invalidateQueries({ queryKey: ["variants", productId] });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete variant?")) return;
    await supabase.from("product_variants").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["variants", productId] });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setForm(empty);
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Variants — {productName}</DialogTitle>
        </DialogHeader>

        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th>Size</th>
                <th>Color</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Sold</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {variants.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                    No variants
                  </td>
                </tr>
              )}
              {variants.map((v) => (
                <tr key={v.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{v.name}</td>
                  <td>{v.size ?? "—"}</td>
                  <td>{v.color ?? "—"}</td>
                  <td className="font-medium">{formatKS(v.price)}</td>
                  <td>{v.stock_in}</td>
                  <td>{v.sold_qty}</td>
                  <td>
                    <Badge variant="outline">{v.status}</Badge>
                  </td>
                  <td className="text-right pr-2">
                    <Button size="icon" variant="ghost" onClick={() => setForm(v)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(v.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-2 border-t">
          <div className="space-y-1 col-span-2">
            <Label className="text-xs">Variant Name</Label>
            <Input
              value={form.name ?? ""}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Size</Label>
            <Input
              value={form.size ?? ""}
              onChange={(e) => setForm({ ...form, size: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Color</Label>
            <Input
              value={form.color ?? ""}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Price</Label>
            <Input
              type="number"
              value={form.price ?? 0}
              onChange={(e) => setForm({ ...form, price: +e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Stock</Label>
            <Input
              type="number"
              value={form.stock_in ?? 0}
              onChange={(e) => setForm({ ...form, stock_in: +e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          {form.id && (
            <Button variant="ghost" onClick={() => setForm(empty)}>
              Cancel edit
            </Button>
          )}
          <Button onClick={save}>
            <Plus className="mr-2 h-4 w-4" />
            {form.id ? "Update Variant" : "Add Variant"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
