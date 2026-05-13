import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Search, Sparkles, ChevronRight, Flame, Clock, Heart, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatKS } from "@/lib/format";
import { StorageImage } from "@/components/StorageImage";
import { CartBadge } from "@/components/shop/CartBadge";
import { ShopAccountButton } from "@/components/shop/ShopAccountButton";
import { isWished, toggleWish } from "@/lib/wishlist";

export const Route = createFileRoute("/shop/")({ component: Storefront });

type SortMode = "newest" | "price-asc" | "price-desc" | "popular";

function Storefront() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [activeBrand, setActiveBrand] = useState<string>("all");
  const [sort, setSort] = useState<SortMode>("newest");

  const { data: settings } = useQuery({
    queryKey: ["public-settings"],
    queryFn: async () =>
      (await supabase.from("settings").select("business_name, logo_url").limit(1).maybeSingle()).data,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["public-products"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, price, image_url, brand, category, waiting_time, stock_in, sold_qty, final_sell_mmk, created_at")
        .eq("status", "ACTIVE")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => p.category && set.add(p.category));
    return Array.from(set).slice(0, 12);
  }, [products]);

  const brands = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => p.brand && set.add(p.brand));
    return Array.from(set).slice(0, 12);
  }, [products]);

  const newArrivals = useMemo(() => products.slice(0, 8), [products]);
  const bestSellers = useMemo(
    () => [...products].sort((a, b) => (b.sold_qty ?? 0) - (a.sold_qty ?? 0)).slice(0, 8),
    [products],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let list = products.filter((p) => {
      if (activeCategory !== "all" && p.category !== activeCategory) return false;
      if (activeBrand !== "all" && p.brand !== activeBrand) return false;
      if (q && ![p.name, p.brand, p.category].filter(Boolean).join(" ").toLowerCase().includes(q)) return false;
      return true;
    });
    if (sort === "price-asc") list = [...list].sort((a, b) => priceOf(a) - priceOf(b));
    else if (sort === "price-desc") list = [...list].sort((a, b) => priceOf(b) - priceOf(a));
    else if (sort === "popular") list = [...list].sort((a, b) => (b.sold_qty ?? 0) - (a.sold_qty ?? 0));
    return list;
  }, [products, search, activeCategory, activeBrand, sort]);

  const isFiltering = search || activeCategory !== "all" || activeBrand !== "all" || sort !== "newest";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/shop" className="flex items-center gap-2">
            <StorageImage
              src={settings?.logo_url}
              alt=""
              className="h-9 w-9 rounded-lg object-cover"
              fallback={
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground">
                  <Sparkles className="h-4 w-4" />
                </div>
              }
            />
            <span className="font-semibold">{settings?.business_name ?? "Shop"}</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/shop/track" className="hidden sm:inline-flex h-9 items-center gap-1 rounded-md border bg-background px-3 text-sm hover:bg-accent">
              <MapPin className="h-4 w-4" />Track
            </Link>
            <Link to="/shop/wishlist" className="inline-flex h-9 items-center gap-1 rounded-md border bg-background px-3 text-sm hover:bg-accent">
              <Heart className="h-4 w-4" /><span className="hidden sm:inline">Wishlist</span>
            </Link>
            <ShopAccountButton />
            <CartBadge />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5">
        {/* Hero */}
        <section className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-primary/15 via-accent/10 to-background p-6 md:p-10">
          <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute -bottom-12 -left-12 h-56 w-56 rounded-full bg-accent/20 blur-3xl" />
          <div className="relative max-w-xl">
            <Badge variant="outline" className="mb-3 bg-background/60">✨ Welcome</Badge>
            <h1 className="text-3xl font-bold leading-tight md:text-5xl">
              Shop the latest at <span className="text-primary">{settings?.business_name ?? "our store"}</span>
            </h1>
            <p className="mt-2 text-sm text-muted-foreground md:text-base">
              Browse freely — no signup required. Add items to cart and checkout in seconds.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild size="lg">
                <a href="#all-products">Shop all <ChevronRight className="ml-1 h-4 w-4" /></a>
              </Button>
              {bestSellers.length > 0 && (
                <Button asChild size="lg" variant="outline">
                  <a href="#best-sellers"><Flame className="mr-1 h-4 w-4" /> Best sellers</a>
                </Button>
              )}
            </div>
          </div>
        </section>

        {/* Search */}
        <div className="relative mb-4 max-w-xl">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products, brands…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Categories scroll */}
        {categories.length > 0 && (
          <div className="mb-3 flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Chip active={activeCategory === "all"} onClick={() => setActiveCategory("all")}>All</Chip>
            {categories.map((c) => (
              <Chip key={c} active={activeCategory === c} onClick={() => setActiveCategory(c)}>{c}</Chip>
            ))}
          </div>
        )}

        {/* Brand + sort row */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          {brands.length > 0 ? (
            <div className="flex gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <Chip small active={activeBrand === "all"} onClick={() => setActiveBrand("all")}>All brands</Chip>
              {brands.map((b) => (
                <Chip small key={b} active={activeBrand === b} onClick={() => setActiveBrand(b)}>{b}</Chip>
              ))}
            </div>
          ) : <span />}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
            className="h-9 rounded-md border bg-background px-2 text-sm"
            aria-label="Sort"
          >
            <option value="newest">Newest</option>
            <option value="popular">Most popular</option>
            <option value="price-asc">Price: low → high</option>
            <option value="price-desc">Price: high → low</option>
          </select>
        </div>

        {!isFiltering && (
          <>
            {newArrivals.length > 0 && (
              <Section title="New arrivals" icon={<Clock className="h-4 w-4" />} products={newArrivals} />
            )}
            {bestSellers.some((p) => (p.sold_qty ?? 0) > 0) && (
              <Section id="best-sellers" title="Best sellers" icon={<Flame className="h-4 w-4 text-orange-500" />} products={bestSellers} />
            )}
          </>
        )}

        <h2 id="all-products" className="mb-3 mt-2 text-lg font-semibold">
          {isFiltering ? `${filtered.length} result${filtered.length === 1 ? "" : "s"}` : "All products"}
        </h2>
        <ProductGrid products={filtered} />
      </main>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {settings?.business_name ?? "Shop"}
      </footer>

      <CartBadge floating />
    </div>
  );
}

function priceOf(p: any) {
  return Number(p.final_sell_mmk ?? p.price ?? 0);
}

function Chip({ children, active, onClick, small }: { children: React.ReactNode; active?: boolean; onClick?: () => void; small?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full border transition-colors ${small ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-sm"} ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-background hover:bg-accent"
      }`}
    >
      {children}
    </button>
  );
}

function Section({ title, icon, products, id }: { title: string; icon?: React.ReactNode; products: any[]; id?: string }) {
  return (
    <section id={id} className="mb-6">
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {products.map((p) => (
          <ProductCard key={p.id} p={p} className="w-40 shrink-0 sm:w-48" />
        ))}
      </div>
    </section>
  );
}

function ProductGrid({ products }: { products: any[] }) {
  if (products.length === 0) return <p className="py-12 text-center text-muted-foreground">No products found</p>;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {products.map((p) => <ProductCard key={p.id} p={p} />)}
    </div>
  );
}

function ProductCard({ p, className = "" }: { p: any; className?: string }) {
  const stock = (p.stock_in ?? 0) - (p.sold_qty ?? 0);
  const price = priceOf(p);
  return (
    <Card className={`group overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lg ${className}`}>
      <Link to="/shop/p/$id" params={{ id: p.id }}>
        <div className="relative aspect-square w-full overflow-hidden bg-muted">
          <StorageImage
            src={p.image_url}
            alt={p.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            fallback={<div className="flex h-full w-full items-center justify-center text-4xl text-muted-foreground/40">📦</div>}
          />
          {stock <= 0 && (
            <Badge className="absolute left-2 top-2 bg-red-500/90 text-white">Out</Badge>
          )}
        </div>
        <CardContent className="space-y-1 p-3">
          {p.brand && <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{p.brand}</p>}
          <p className="line-clamp-2 text-sm font-medium leading-tight">{p.name}</p>
          <p className="pt-1 font-semibold text-primary">{formatKS(price)}</p>
        </CardContent>
      </Link>
    </Card>
  );
}
