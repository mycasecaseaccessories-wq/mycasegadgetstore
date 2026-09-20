import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Check, Minus, Plus, ShieldCheck, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { formatKS } from "@/lib/format";
import { addToCart } from "@/lib/cart";
import { toast } from "sonner";
import { StorageImage } from "@/components/StorageImage";
import { CartBadge } from "@/components/shop/CartBadge";
import { ShopAccountButton } from "@/components/shop/ShopAccountButton";

export const Route = createFileRoute("/shop/p/$id")({ component: ProductPage });

function ProductPage() {
  const { id } = Route.useParams();

  const { data: product } = useQuery({
    queryKey: ["public-product", id],
    queryFn: async () =>
      (
        await (supabase.from("products" as any) as any)
          .select(
            "id, name, size, price, waiting_time, stock_status, category, product_code, brand, status, stock_in, sold_qty, final_sell_mmk, image_url, selling_mode, availability, preorder_enabled, preorder_deposit, preorder_deposit_type",
          )
          .eq("id", id)
          .eq("status", "ACTIVE")
          .maybeSingle()
      ).data,
  });

  const { data: variants = [] } = useQuery({
    queryKey: ["public-variants", id],
    queryFn: async () =>
      (
        await supabase
          .from("product_variants")
          .select(
            "id, product_id, variant_code, name, size, color, price, final_sell_mmk, stock_in, sold_qty, status",
          )
          .eq("product_id", id)
          .eq("status", "ACTIVE")
      ).data ?? [],
  });

  const { data: related = [] } = useQuery({
    queryKey: ["public-related", product?.category, id],
    enabled: !!product,
    queryFn: async () => {
      const q = (supabase.from("products" as any) as any)
        .select("id, name, image_url, brand, price, final_sell_mmk")
        .eq("status", "ACTIVE")
        .neq("id", id)
        .limit(8);
      if (product?.category) q.eq("category", product.category);
      return (await q).data ?? [];
    },
  });
  const [quantity, setQuantity] = useState(1);

  if (!product) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;

  const stock = (product.stock_in ?? 0) - (product.sold_qty ?? 0);
  const price = Number(product.final_sell_mmk ?? product.price ?? 0);
  const canPreorder = Boolean(product.preorder_enabled) &&
    (product.selling_mode === "PREORDER" || product.selling_mode === "BOTH");
  const preorderDeposit = product.preorder_deposit_type === "PERCENTAGE"
    ? Math.min(price, (price * Math.min(100, Math.max(0, Number(product.preorder_deposit ?? 0)))) / 100)
    : Math.min(price, Math.max(0, Number(product.preorder_deposit ?? 0)));
  const fulfillmentType = stock <= 0 && canPreorder ? "PREORDER" : "IN_STOCK";

  const buy = (variantId?: string, variantName?: string, variantPrice?: number, qty = quantity) => {
    addToCart({
      id: variantId ?? product.id,
      product_id: product.id,
      name: variantName ? `${product.name} — ${variantName}` : product.name,
      price: variantPrice ?? price,
      qty,
      image_url: product.image_url ?? null,
      fulfillment_type: fulfillmentType,
      estimated_arrival: product.waiting_time,
      deposit_required: preorderDeposit,
    });
    toast.success(`${qty} item${qty === 1 ? "" : "s"} added to cart`);
  };

  return (
    <div className="motion-page min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/shop">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <ShopAccountButton />
            <CartBadge />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-4">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="motion-hero-art aspect-square overflow-hidden rounded-2xl bg-muted">
            <StorageImage
              src={product.image_url}
              alt={product.name}
              className="h-full w-full object-cover"
              fallback={
                <div className="flex h-full w-full items-center justify-center text-6xl text-muted-foreground/30">
                  📦
                </div>
              }
            />
          </div>
          <div className="motion-section space-y-3">
            {product.brand && (
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {product.brand}
              </p>
            )}
            <h1 className="text-2xl font-bold leading-tight md:text-3xl">{product.name}</h1>
            <p className="text-3xl font-bold text-primary">{formatKS(price)}</p>
            <div className="flex flex-wrap gap-2">
              {stock <= 0 && canPreorder ? (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-700">
                  Pre-order available
                </Badge>
              ) : stock <= 0 ? (
                <Badge variant="outline" className="bg-red-500/10 text-red-600">
                  Out of stock
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-green-500/10 text-green-600">
                  <Check className="mr-1 h-3 w-3" />
                  In stock ({stock})
                </Badge>
              )}
              {product.waiting_time && (
                <Badge variant="outline" className="bg-muted">
                  ⏱ {product.waiting_time}
                </Badge>
              )}
              {canPreorder && preorderDeposit > 0 && (
                <Badge variant="outline" className="bg-muted">
                  Deposit {formatKS(preorderDeposit)}
                </Badge>
              )}
            </div>

            {variants.length === 0 ? (
              <div className="mt-2 flex gap-2">
                <div className="flex h-12 items-center rounded-xl border">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Decrease quantity"
                    onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-9 text-center text-sm font-semibold" aria-live="polite">
                    {quantity}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Increase quantity"
                    onClick={() => setQuantity((value) => Math.min(Math.max(1, stock), value + 1))}
                    disabled={quantity >= stock}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  size="lg"
                  className="h-12 flex-1 rounded-xl"
                  disabled={stock <= 0 && !canPreorder}
                  onClick={() => buy()}
                >
                  <ShoppingBag className="mr-2 h-4 w-4" />
                  {fulfillmentType === "PREORDER" ? "Pre-order" : "Add to cart"}
                </Button>
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                <p className="text-sm font-medium">Choose variant:</p>
                {variants.map((v: any) => {
                  const vPrice = Number(v.final_sell_mmk ?? v.price ?? 0);
                  return (
                    <div
                      key={v.id}
                      className="flex items-center justify-between rounded-md border p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{v.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {[v.color, v.size].filter(Boolean).join(" / ")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{formatKS(vPrice)}</span>
                        <Button
                          size="sm"
                          disabled={(v.stock_in ?? 0) - (v.sold_qty ?? 0) <= 0}
                          onClick={() => buy(v.id, v.name, vPrice, 1)}
                        >
                          Add
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2 rounded-md border p-2">
                <Check className="h-4 w-4 text-primary" /> Live stock status
              </div>
              <div className="flex items-center gap-2 rounded-md border p-2">
                <ShieldCheck className="h-4 w-4 text-primary" /> Secure account checkout
              </div>
            </div>
          </div>
        </div>

        <section className="mt-10 grid gap-6 border-y border-[#dfe6e1] py-8 sm:grid-cols-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.16em]">Product details</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {product.name} is available through the MY CASE storefront while stock lasts.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.16em]">Specifications</h2>
            <dl className="mt-3 grid gap-2 text-sm text-muted-foreground">
              {product.brand && (
                <div className="flex justify-between gap-3">
                  <dt>Brand</dt>
                  <dd className="font-medium text-foreground">{product.brand}</dd>
                </div>
              )}
              {product.category && (
                <div className="flex justify-between gap-3">
                  <dt>Category</dt>
                  <dd className="font-medium text-foreground">{product.category}</dd>
                </div>
              )}
              {product.size && (
                <div className="flex justify-between gap-3">
                  <dt>Size / model</dt>
                  <dd className="font-medium text-foreground">{product.size}</dd>
                </div>
              )}
            </dl>
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.16em]">Shopping note</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Prices are shown in MMK. Add the item to your cart to continue when you are ready.
            </p>
          </div>
        </section>

        {related.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-3 text-lg font-semibold">You may also like</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {related.map((r: any) => {
                const rp = Number(r.final_sell_mmk ?? r.price ?? 0);
                return (
                  <Card
                    key={r.id}
                    className="group overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <Link to="/shop/p/$id" params={{ id: r.id }}>
                      <div className="aspect-square w-full overflow-hidden bg-muted">
                        <StorageImage
                          src={r.image_url}
                          alt={r.name}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          fallback={
                            <div className="flex h-full w-full items-center justify-center text-3xl text-muted-foreground/40">
                              📦
                            </div>
                          }
                        />
                      </div>
                      <CardContent className="space-y-1 p-2.5">
                        {r.brand && (
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            {r.brand}
                          </p>
                        )}
                        <p className="line-clamp-2 text-xs font-medium leading-tight">{r.name}</p>
                        <p className="text-sm font-semibold text-primary">{formatKS(rp)}</p>
                      </CardContent>
                    </Link>
                  </Card>
                );
              })}
            </div>
          </section>
        )}
      </div>

      <CartBadge floating />
    </div>
  );
}
