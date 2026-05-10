import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatKS } from "@/lib/format";
import { addToCart } from "@/lib/cart";
import { toast } from "sonner";

export const Route = createFileRoute("/shop/p/$id")({ component: ProductPage });

function ProductPage() {
  const { id } = Route.useParams();
  

  const { data: product } = useQuery({
    queryKey: ["public-product", id],
    queryFn: async () => (await supabase.from("products").select("*").eq("id", id).eq("status", "ACTIVE").maybeSingle()).data,
  });

  const { data: variants = [] } = useQuery({
    queryKey: ["public-variants", id],
    queryFn: async () => (await supabase.from("product_variants").select("*").eq("product_id", id).eq("status", "ACTIVE")).data ?? [],
  });

  if (!product) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;

  const stock = (product.stock_in ?? 0) - (product.sold_qty ?? 0);
  const price = Number(product.final_sell_mmk ?? product.price ?? 0);

  const buy = (variantId?: string, variantName?: string, variantPrice?: number) => {
    addToCart({
      id: variantId ?? product.id,
      product_id: product.id,
      name: variantName ? `${product.name} — ${variantName}` : product.name,
      price: variantPrice ?? price,
      qty: 1,
      image_url: product.image_url ?? null,
    });
    toast.success("Added to cart");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-4">
        <div className="mb-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild><Link to="/shop"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link></Button>
          <Button variant="outline" size="sm" asChild><Link to="/shop/cart"><ShoppingCart className="mr-2 h-4 w-4" />Cart</Link></Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="aspect-square overflow-hidden rounded-xl bg-muted">
            {product.image_url ? <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-6xl text-muted-foreground/30">📦</div>}
          </div>
          <div className="space-y-3">
            {product.brand && <p className="text-xs uppercase tracking-wide text-muted-foreground">{product.brand}</p>}
            <h1 className="text-2xl font-bold">{product.name}</h1>
            <p className="text-2xl font-bold text-primary">{formatKS(price)}</p>
            {product.waiting_time && <p className="text-sm text-muted-foreground">⏱ {product.waiting_time}</p>}
            {stock <= 0 ? <Badge variant="outline" className="bg-red-500/10 text-red-600">Out of stock</Badge> : <Badge variant="outline" className="bg-green-500/10 text-green-600">In stock ({stock})</Badge>}
            {product.note && <p className="whitespace-pre-line text-sm text-muted-foreground">{product.note}</p>}

            {variants.length === 0 ? (
              <Button size="lg" className="mt-2 w-full" disabled={stock <= 0} onClick={() => buy()}>Add to cart</Button>
            ) : (
              <div className="mt-2 space-y-2">
                <p className="text-sm font-medium">Choose variant:</p>
                {variants.map((v: any) => {
                  const vPrice = Number(v.final_sell_mmk ?? v.price ?? 0);
                  return (
                    <div key={v.id} className="flex items-center justify-between rounded-md border p-3">
                      <div>
                        <p className="text-sm font-medium">{v.name}</p>
                        <p className="text-xs text-muted-foreground">{[v.color, v.size].filter(Boolean).join(" / ")}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{formatKS(vPrice)}</span>
                        <Button size="sm" onClick={() => buy(v.id, v.name, vPrice)}>Add</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
