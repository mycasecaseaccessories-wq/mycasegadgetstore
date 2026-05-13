import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Heart, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { StorageImage } from "@/components/StorageImage";
import { formatKS } from "@/lib/format";
import { getWishlist, removeWish } from "@/lib/wishlist";

export const Route = createFileRoute("/shop/wishlist")({ component: WishlistPage });

function WishlistPage() {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    setIds(getWishlist());
    const h = () => setIds(getWishlist());
    window.addEventListener("wishlist-updated", h);
    return () => window.removeEventListener("wishlist-updated", h);
  }, []);

  const { data: products = [] } = useQuery({
    queryKey: ["wishlist-products", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("products")
        .select("id, name, price, image_url, brand, final_sell_mmk")
        .in("id", ids).eq("status", "ACTIVE");
      return data ?? [];
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/shop" className="text-sm font-semibold">← Back to shop</Link>
          <h1 className="flex items-center gap-2 text-sm font-medium"><Heart className="h-4 w-4 fill-red-500 text-red-500" />My Wishlist</h1>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">
        {ids.length === 0 ? (
          <p className="py-16 text-center text-muted-foreground">Your wishlist is empty. Tap the ♥ on any product to save it.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {products.map((p: any) => (
              <Card key={p.id} className="group overflow-hidden">
                <Link to="/shop/p/$id" params={{ id: p.id }}>
                  <div className="aspect-square w-full overflow-hidden bg-muted">
                    <StorageImage src={p.image_url} alt={p.name} className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      fallback={<div className="flex h-full w-full items-center justify-center text-4xl text-muted-foreground/40">📦</div>} />
                  </div>
                  <CardContent className="space-y-1 p-3">
                    {p.brand && <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{p.brand}</p>}
                    <p className="line-clamp-2 text-sm font-medium">{p.name}</p>
                    <p className="pt-1 font-semibold text-primary">{formatKS(Number(p.final_sell_mmk ?? p.price ?? 0))}</p>
                  </CardContent>
                </Link>
                <div className="border-t p-2">
                  <Button size="sm" variant="ghost" className="w-full text-xs" onClick={() => removeWish(p.id)}>
                    <Trash2 className="mr-1 h-3 w-3" />Remove
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
