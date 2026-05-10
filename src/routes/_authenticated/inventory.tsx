import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, Package, Search, TrendingDown, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatKS } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/inventory")({ component: InventoryPage });

type Row = {
  id: string; name: string; image_url: string | null; price: number;
  stock_in: number; sold_qty: number; low_stock_threshold: number;
  stock_status: string; category: string | null;
};

function InventoryPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "out">("all");

  const { data: products = [] } = useQuery({
    queryKey: ["inventory-products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name, image_url, price, stock_in, sold_qty, low_stock_threshold, stock_status, category").order("name");
      if (error) throw error;
      return data as Row[];
    },
  });

  const enriched = products.map(p => {
    const remaining = (p.stock_in ?? 0) - (p.sold_qty ?? 0);
    const threshold = p.low_stock_threshold ?? 5;
    const state: "ok" | "low" | "out" = remaining <= 0 ? "out" : remaining <= threshold ? "low" : "ok";
    return { ...p, remaining, threshold, state };
  });

  const filtered = enriched.filter(p => {
    if (filter === "low" && p.state !== "low") return false;
    if (filter === "out" && p.state !== "out") return false;
    return !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.category ?? "").toLowerCase().includes(search.toLowerCase());
  });

  const counts = {
    total: enriched.length,
    ok: enriched.filter(p => p.state === "ok").length,
    low: enriched.filter(p => p.state === "low").length,
    out: enriched.filter(p => p.state === "out").length,
    inventoryValue: enriched.reduce((s, p) => s + Math.max(0, p.remaining) * Number(p.price), 0),
  };

  const adjust = async (id: string, delta: number) => {
    const p = products.find(x => x.id === id);
    if (!p) return;
    const next = Math.max(0, (p.stock_in ?? 0) + delta);
    const { error } = await supabase.from("products").update({ stock_in: next }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["inventory-products"] });
    qc.invalidateQueries({ queryKey: ["products"] });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="All" value={String(counts.total)} icon={<Package className="h-4 w-4" />} />
        <Stat label="In Stock" value={String(counts.ok)} accent="text-green-600" />
        <Stat label="Low" value={String(counts.low)} accent="text-amber-600" icon={<AlertTriangle className="h-4 w-4 text-amber-600" />} />
        <Stat label="Out" value={String(counts.out)} accent="text-red-600" icon={<TrendingDown className="h-4 w-4 text-red-600" />} />
        <Stat label="Stock Value" value={formatKS(counts.inventoryValue)} />
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by product or category…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>All</Button>
            <Button size="sm" variant={filter === "low" ? "default" : "outline"} onClick={() => setFilter("low")} className={filter !== "low" ? "text-amber-600" : ""}>Low ({counts.low})</Button>
            <Button size="sm" variant={filter === "out" ? "default" : "outline"} onClick={() => setFilter("out")} className={filter !== "out" ? "text-red-600" : ""}>Out ({counts.out})</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{filter === "low" ? "Low-stock products" : filter === "out" ? "Out-of-stock products" : "All inventory"}</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Product</th><th>Category</th><th>Stock In</th><th>Sold</th>
                <th>Remaining</th><th>Threshold</th><th>State</th><th className="text-right pr-4">Adjust</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No products</td></tr>}
              {filtered.map(p => (
                <tr key={p.id} className="border-t">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-3">
                      {p.image_url ? <img src={p.image_url} alt="" className="h-10 w-10 rounded object-cover" /> : <div className="h-10 w-10 rounded bg-muted" />}
                      <Link to="/products" className="font-medium hover:underline">{p.name}<ExternalLink className="ml-1 inline h-3 w-3" /></Link>
                    </div>
                  </td>
                  <td className="text-muted-foreground">{p.category ?? "—"}</td>
                  <td>{p.stock_in}</td>
                  <td className="text-muted-foreground">{p.sold_qty}</td>
                  <td className="font-semibold">{p.remaining}</td>
                  <td className="text-muted-foreground">{p.threshold}</td>
                  <td>
                    {p.state === "ok" && <Badge variant="outline" className="bg-green-500/10 text-green-600">OK</Badge>}
                    {p.state === "low" && <Badge variant="outline" className="bg-amber-500/10 text-amber-600">Low</Badge>}
                    {p.state === "out" && <Badge variant="outline" className="bg-red-500/10 text-red-600">Out</Badge>}
                  </td>
                  <td className="px-4 text-right">
                    <Button size="sm" variant="outline" onClick={() => adjust(p.id, -1)}>−1</Button>
                    <Button size="sm" variant="outline" className="ml-1" onClick={() => adjust(p.id, 1)}>+1</Button>
                    <Button size="sm" variant="outline" className="ml-1" onClick={() => adjust(p.id, 10)}>+10</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, icon, accent }: { label: string; value: string; icon?: React.ReactNode; accent?: string }) {
  return (
    <Card><CardContent className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground">{icon}<span className="text-xs">{label}</span></div>
      <p className={`mt-1 text-lg font-semibold ${accent ?? ""}`}>{value}</p>
    </CardContent></Card>
  );
}
