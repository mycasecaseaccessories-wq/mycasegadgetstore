import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ShoppingCart, Search, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatKS } from "@/lib/format";
import { StorageImage } from "@/components/StorageImage";

export const Route = createFileRoute("/shop/")({ component: Storefront });

function Storefront() {
  const [search, setSearch] = useState("");

  const { data: settings } = useQuery({
    queryKey: ["public-settings"],
    queryFn: async () => (await supabase.from("settings").select("business_name, logo_url").limit(1).maybeSingle()).data,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["public-products"],
    queryFn: async () => {
      const { data } = await supabase.from("products")
        .select("id, name, price, image_url, brand, category, waiting_time, stock_in, sold_qty, final_sell_mmk")
        .eq("status", "ACTIVE")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter(p => !q || [p.name, p.brand, p.category].filter(Boolean).join(" ").toLowerCase().includes(q));
  }, [products, search]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/shop" className="flex items-center gap-2">
            {settings?.logo_url ? <img src={settings.logo_url} alt="" className="h-9 w-9 rounded-lg object-cover" /> : (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground"><Sparkles className="h-4 w-4" /></div>
            )}
            <span className="font-semibold">{settings?.business_name ?? "Shop"}</span>
          </Link>
          <Button variant="outline" size="sm" asChild><Link to="/shop/cart"><ShoppingCart className="mr-2 h-4 w-4" />Cart</Link></Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="relative mb-6 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search products…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {filtered.map(p => {
            const stock = (p.stock_in ?? 0) - (p.sold_qty ?? 0);
            const price = Number(p.final_sell_mmk ?? p.price ?? 0);
            return (
              <Card key={p.id} className="group overflow-hidden transition-shadow hover:shadow-lg">
                <Link to="/shop/p/$id" params={{ id: p.id }}>
                  <div className="aspect-square w-full overflow-hidden bg-muted">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-4xl text-muted-foreground/40">📦</div>
                    )}
                  </div>
                  <CardContent className="space-y-1 p-3">
                    {p.brand && <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{p.brand}</p>}
                    <p className="line-clamp-2 text-sm font-medium">{p.name}</p>
                    <div className="flex items-center justify-between pt-1">
                      <p className="font-semibold text-primary">{formatKS(price)}</p>
                      {stock <= 0 ? <Badge variant="outline" className="bg-red-500/10 text-red-600">Out</Badge> : null}
                    </div>
                  </CardContent>
                </Link>
              </Card>
            );
          })}
          {filtered.length === 0 && <p className="col-span-full py-12 text-center text-muted-foreground">No products found</p>}
        </div>
      </main>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {settings?.business_name ?? "Shop"}
      </footer>
    </div>
  );
}
