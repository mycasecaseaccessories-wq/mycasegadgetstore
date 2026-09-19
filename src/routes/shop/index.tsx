import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Heart,
  Menu,
  Search,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Truck,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { formatKS } from "@/lib/format";
import { StorageImage } from "@/components/StorageImage";
import { CartBadge } from "@/components/shop/CartBadge";
import { ShopAccountButton } from "@/components/shop/ShopAccountButton";
import { isWished, toggleWish } from "@/lib/wishlist";
import { addToCart } from "@/lib/cart";
import { toast } from "sonner";

export const Route = createFileRoute("/shop/")({ component: Storefront });

type SortMode = "featured" | "popular" | "price-asc" | "price-desc" | "newest";

type Product = {
  id: string;
  name: string;
  price: number | null;
  final_sell_mmk: number | null;
  image_url: string | null;
  brand: string | null;
  category: string | null;
  stock_in: number | null;
  sold_qty: number | null;
  created_at: string;
};

function Storefront() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeBrand, setActiveBrand] = useState("all");
  const [sort, setSort] = useState<SortMode>("featured");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["public-settings"],
    queryFn: async () => {
      try {
        return (
          await supabase.from("settings").select("business_name, logo_url").limit(1).maybeSingle()
        ).data;
      } catch (error) {
        console.error("Unable to load storefront settings", error);
        return null;
      }
    },
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["public-products"],
    queryFn: async () => {
      try {
        const { data } = await supabase
          .from("products")
          .select(
            "id, name, price, image_url, brand, category, stock_in, sold_qty, final_sell_mmk, created_at",
          )
          .eq("status", "ACTIVE")
          .order("created_at", { ascending: false });
        return (data ?? []) as Product[];
      } catch (error) {
        console.error("Unable to load storefront products", error);
        return [];
      }
    },
  });

  const categories = useMemo(() => uniqueValues(products, "category"), [products]);
  const brands = useMemo(() => uniqueValues(products, "brand"), [products]);
  const categoryCards = useMemo(
    () =>
      categories.slice(0, 8).map((name) => ({
        name,
        product: products.find((product) => product.category === name),
      })),
    [categories, products],
  );
  const newArrivals = useMemo(() => products.slice(0, 8), [products]);
  const bestSellers = useMemo(
    () =>
      [...products]
        .sort((a, b) => stockValue(b) - stockValue(a) + (b.sold_qty ?? 0) - (a.sold_qty ?? 0))
        .slice(0, 8),
    [products],
  );
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = products.filter((product) => {
      const matchesQuery =
        !query ||
        [product.name, product.brand, product.category]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);
      const matchesCategory = activeCategory === "all" || product.category === activeCategory;
      const matchesBrand = activeBrand === "all" || product.brand === activeBrand;
      return matchesQuery && matchesCategory && matchesBrand;
    });
    if (sort === "popular")
      return [...result].sort((a, b) => (b.sold_qty ?? 0) - (a.sold_qty ?? 0));
    if (sort === "price-asc") return [...result].sort((a, b) => priceOf(a) - priceOf(b));
    if (sort === "price-desc") return [...result].sort((a, b) => priceOf(b) - priceOf(a));
    if (sort === "newest")
      return [...result].sort((a, b) => b.created_at.localeCompare(a.created_at));
    return result;
  }, [products, search, activeCategory, activeBrand, sort]);
  const hasFilters =
    Boolean(search) || activeCategory !== "all" || activeBrand !== "all" || sort !== "featured";

  const clearFilters = () => {
    setSearch("");
    setActiveCategory("all");
    setActiveBrand("all");
    setSort("featured");
  };
  const chooseCategory = (category: string) => {
    setActiveCategory(category);
    setSort("featured");
    document.getElementById("collection")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-[#f7f8f6] text-[#18211f] dark:bg-background dark:text-foreground">
      <div className="border-b border-[#dfe6e1] bg-[#18211f] px-4 py-2 text-center text-[11px] font-medium tracking-[0.16em] text-white/80">
        AUTHENTIC GADGETS · CLEAR MMK PRICING · EASY SHOPPING
      </div>
      <header className="sticky top-0 z-30 border-b border-[#dfe6e1] bg-[#f7f8f6]/95 backdrop-blur dark:bg-background/95">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4 lg:px-8">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[86vw] max-w-sm">
              <SheetHeader>
                <SheetTitle className="text-left">MY CASE</SheetTitle>
              </SheetHeader>
              <nav className="mt-8 grid gap-2" aria-label="Mobile navigation">
                {categories.slice(0, 8).map((category) => (
                  <button
                    key={category}
                    className="border-b py-3 text-left text-sm"
                    onClick={() => {
                      chooseCategory(category);
                      setMobileMenuOpen(false);
                    }}
                  >
                    {category}
                  </button>
                ))}
                <Link className="border-b py-3 text-sm" to="/shop/wishlist">
                  Wishlist
                </Link>
                <Link className="border-b py-3 text-sm" to="/shop/track">
                  Track order
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
          <Link to="/shop" className="flex shrink-0 items-center gap-2" aria-label="MY CASE home">
            {settings?.logo_url ? (
              <StorageImage
                src={settings.logo_url}
                alt="MY CASE"
                className="h-9 w-9 rounded-md object-cover"
              />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#b8e7d0] text-sm font-black text-[#18211f]">
                MC
              </span>
            )}
            <span className="text-base font-black tracking-[0.22em]">MY CASE</span>
          </Link>
          <nav
            className="hidden items-center gap-5 pl-8 text-sm font-medium lg:flex"
            aria-label="Main navigation"
          >
            <button onClick={() => chooseCategory("all")} className="hover:text-[#247a62]">
              Shop
            </button>
            {categories.slice(0, 6).map((category) => (
              <button
                key={category}
                onClick={() => chooseCategory(category)}
                className="max-w-24 truncate hover:text-[#247a62]"
              >
                {category}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="relative hidden w-52 xl:block">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search gadgets"
                aria-label="Search products"
                className="h-9 rounded-full border-[#dfe6e1] bg-white pl-9"
              />
            </div>
            <Link
              to="/shop/wishlist"
              aria-label="Wishlist"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-[#e8f0eb]"
            >
              <Heart className="h-4 w-4" />
            </Link>
            <ShopAccountButton />
            <CartBadge />
          </div>
        </div>
        <div className="border-t border-[#dfe6e1] px-4 py-2 lg:hidden">
          <div className="relative mx-auto max-w-7xl">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search products, brands"
              aria-label="Search products"
              className="h-9 rounded-full border-[#dfe6e1] bg-white pl-9"
            />
          </div>
        </div>
      </header>

      <main className="motion-page">
        <section className="motion-hero mx-auto grid max-w-7xl gap-8 px-4 pb-12 pt-10 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:pb-20 lg:pt-16">
          <div className="flex flex-col justify-center">
            <p className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-[#247a62]">
              <Sparkles className="h-4 w-4" /> New season, better essentials
            </p>
            <h1 className="max-w-2xl text-4xl font-black leading-[1.02] tracking-[-0.04em] sm:text-6xl">
              Premium cases & accessories for your everyday.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-[#64716b] dark:text-muted-foreground">
              Discover dependable gadgets, thoughtful protection, and clean essentials selected for
              the way you move.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button
                size="lg"
                className="rounded-full bg-[#18211f] px-6 text-white hover:bg-[#247a62]"
                onClick={() =>
                  document.getElementById("collection")?.scrollIntoView({ behavior: "smooth" })
                }
              >
                Shop now <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              {categories[0] && (
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-full border-[#b8c9bf]"
                  onClick={() => chooseCategory(categories[0])}
                >
                  {categories[0]}
                </Button>
              )}
            </div>
            <div className="mt-9 grid max-w-md grid-cols-3 gap-4 border-t border-[#dfe6e1] pt-5 text-xs text-[#64716b] dark:text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-[#247a62]" /> Live stock
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-[#247a62]" /> Clear pricing
              </span>
              <span className="flex items-center gap-1.5">
                <Truck className="h-4 w-4 text-[#247a62]" /> Easy checkout
              </span>
            </div>
          </div>
          <div className="motion-hero-art relative min-h-[340px] overflow-hidden rounded-[2rem] bg-[#dcece3] lg:min-h-[500px]">
            {newArrivals[0] ? (
              <StorageImage
                src={newArrivals[0].image_url}
                alt={newArrivals[0].name}
                className="h-full w-full object-cover"
                fallback={<HeroFallback />}
              />
            ) : (
              <HeroFallback />
            )}
            <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between rounded-2xl bg-[#18211f]/90 p-4 text-white backdrop-blur">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/60">
                  Featured arrival
                </p>
                <p className="mt-1 line-clamp-1 text-sm font-semibold">
                  {newArrivals[0]?.name ?? "Curated essentials"}
                </p>
              </div>
              <ArrowRight className="h-5 w-5 shrink-0 text-[#b8e7d0]" />
            </div>
          </div>
        </section>

        <section className="motion-section mx-auto max-w-7xl px-4 pb-12 lg:px-8">
          <SectionHeading eyebrow="Browse the collection" title="Shop by category" />
          {categoryCards.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {categoryCards.map(({ name, product }) => (
                <button
                  key={name}
                  onClick={() => chooseCategory(name)}
                  className="motion-card group relative aspect-[1.2] overflow-hidden rounded-2xl bg-[#e4ece7] text-left"
                >
                  <StorageImage
                    src={product?.image_url}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    fallback={<div className="h-full w-full bg-[#dcece3]" />}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#18211f]/80 to-transparent" />
                  <span className="absolute bottom-4 left-4 right-3 text-sm font-bold text-white">
                    {name}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Categories are coming soon"
              description="Browse the full collection below."
            />
          )}
        </section>

        <section className="motion-section border-y border-[#dfe6e1] bg-white/70 py-12 dark:bg-card/30">
          <div className="mx-auto max-w-7xl px-4 lg:px-8">
            <SectionHeading
              eyebrow="Just landed"
              title="New arrivals"
              action={
                <button
                  onClick={() => {
                    clearFilters();
                    document.getElementById("collection")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="text-sm font-semibold text-[#247a62]"
                >
                  View all <ArrowRight className="ml-1 inline h-4 w-4" />
                </button>
              }
            />
            <ProductRail products={newArrivals} />
          </div>
        </section>

        <section
          id="collection"
          className="motion-section mx-auto max-w-7xl scroll-mt-32 px-4 py-12 lg:px-8"
        >
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#247a62]">
                The collection
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.03em]">
                Find your next essential.
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">{filtered.length} products</p>
          </div>
          <div className="flex items-center justify-between gap-3 border-b border-[#dfe6e1] pb-4">
            <div className="hidden items-center gap-2 lg:flex">
              <SlidersHorizontal className="h-4 w-4" />
              <span className="text-sm font-semibold">Filter by</span>
              <FilterSelect
                label="Category"
                value={activeCategory}
                options={categories}
                onChange={setActiveCategory}
              />
              <FilterSelect
                label="Brand"
                value={activeBrand}
                options={brands}
                onChange={setActiveBrand}
              />
            </div>
            <div className="flex w-full items-center justify-between gap-2 lg:w-auto">
              <MobileFilter
                categories={categories}
                brands={brands}
                activeCategory={activeCategory}
                activeBrand={activeBrand}
                setActiveCategory={setActiveCategory}
                setActiveBrand={setActiveBrand}
                clearFilters={clearFilters}
              />
              <label className="flex items-center gap-2 text-sm">
                <span className="hidden text-muted-foreground sm:inline">Sort by</span>
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as SortMode)}
                  className="h-9 rounded-full border border-[#dfe6e1] bg-transparent px-3 text-sm"
                  aria-label="Sort products"
                >
                  <option value="featured">Featured</option>
                  <option value="popular">Best selling</option>
                  <option value="price-asc">Price low to high</option>
                  <option value="price-desc">Price high to low</option>
                  <option value="newest">Newest</option>
                </select>
              </label>
            </div>
          </div>
          {isLoading ? (
            <ProductSkeleton />
          ) : filtered.length > 0 ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-8 pt-7 sm:grid-cols-3 lg:grid-cols-4">
              {filtered.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No products found"
              description="Try another search or clear your filters."
              action={
                <Button variant="outline" className="rounded-full" onClick={clearFilters}>
                  Clear search
                </Button>
              }
            />
          )}
        </section>
      </main>

      <footer className="bg-[#18211f] px-4 py-12 text-white lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <p className="text-lg font-black tracking-[0.22em]">MY CASE</p>
            <p className="mt-4 max-w-xs text-sm leading-6 text-white/60">
              Premium phone cases, chargers, cables, audio products, and everyday gadgets.
            </p>
          </div>
          <FooterColumn
            title="Shop"
            links={categories
              .slice(0, 5)
              .map((category) => ({ label: category, onClick: () => chooseCategory(category) }))}
          />
          <FooterColumn
            title="Customer care"
            links={[
              { label: "Wishlist", to: "/shop/wishlist" },
              { label: "Track order", to: "/shop/track" },
              { label: "My account", to: "/shop/account" },
            ]}
          />
          <div>
            <p className="text-sm font-semibold">Stay close</p>
            <p className="mt-3 text-sm leading-6 text-white/60">
              Save your favourites and keep your cart ready for your next visit.
            </p>
            <Link
              to="/shop/wishlist"
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#b8e7d0]"
            >
              View wishlist <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
        <div className="mx-auto mt-10 max-w-7xl border-t border-white/10 pt-5 text-xs text-white/40">
          © {new Date().getFullYear()} {settings?.business_name ?? "MY CASE"}. All rights reserved.
        </div>
      </footer>
      <CartBadge floating />
    </div>
  );
}

function ProductCard({ product }: { product: Product }) {
  const [wished, setWished] = useState(false);
  const stock = stockValue(product);
  const price = priceOf(product);
  useEffect(() => {
    setWished(isWished(product.id));
    const handler = () => setWished(isWished(product.id));
    window.addEventListener("wishlist-updated", handler);
    return () => window.removeEventListener("wishlist-updated", handler);
  }, [product.id]);
  return (
    <article className="motion-product group">
      <div className="relative overflow-hidden rounded-2xl bg-[#e8efea] dark:bg-muted">
        <Link to="/shop/p/$id" params={{ id: product.id }}>
          <div className="aspect-[0.92] overflow-hidden">
            <StorageImage
              src={product.image_url}
              alt={product.name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              fallback={
                <div className="flex h-full w-full items-center justify-center text-4xl text-muted-foreground/40">
                  ▧
                </div>
              }
            />
          </div>
        </Link>
        <button
          onClick={() => {
            toggleWish(product.id);
            setWished(!wished);
          }}
          aria-label={
            wished ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`
          }
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[#18211f] shadow-sm transition hover:bg-[#b8e7d0]"
        >
          <Heart className={wished ? "h-4 w-4 fill-current" : "h-4 w-4"} />
        </button>
        {stock <= 0 && (
          <Badge className="absolute left-3 top-3 bg-[#18211f] text-white">Out of stock</Badge>
        )}
        <Button
          size="sm"
          disabled={stock <= 0}
          onClick={() => {
            addToCart({
              id: product.id,
              product_id: product.id,
              name: product.name,
              price,
              qty: 1,
              image_url: product.image_url,
            });
            toast.success("Added to cart");
          }}
          className="absolute bottom-3 left-3 right-3 hidden rounded-full bg-white text-[#18211f] shadow-sm hover:bg-[#b8e7d0] sm:flex"
        >
          {stock > 0 ? (
            <>
              <ShoppingBag className="mr-2 h-3.5 w-3.5" />
              Add to cart
            </>
          ) : (
            "Out of stock"
          )}
        </Button>
      </div>
      <Link to="/shop/p/$id" params={{ id: product.id }} className="block pt-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b7a72]">
          {product.brand ?? product.category ?? "MY CASE"}
        </p>
        <h3 className="mt-1 line-clamp-2 min-h-10 text-sm font-semibold leading-5">
          {product.name}
        </h3>
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="font-bold">{formatKS(price)}</p>
          <span className="text-[10px] text-muted-foreground">
            {stock > 0 ? "In stock" : "Unavailable"}
          </span>
        </div>
      </Link>
    </article>
  );
}

function ProductRail({ products }: { products: Product[] }) {
  return products.length ? (
    <div className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {products.map((product) => (
        <div key={product.id} className="w-44 shrink-0 sm:w-52">
          <ProductCard product={product} />
        </div>
      ))}
    </div>
  ) : (
    <EmptyState
      title="New arrivals are coming soon"
      description="Check back for the latest MY CASE essentials."
    />
  );
}
function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-full border border-[#dfe6e1] px-3 py-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="max-w-28 bg-transparent font-semibold outline-none"
      >
        <option value="all">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
function MobileFilter({
  categories,
  brands,
  activeCategory,
  activeBrand,
  setActiveCategory,
  setActiveBrand,
  clearFilters,
}: {
  categories: string[];
  brands: string[];
  activeCategory: string;
  activeBrand: string;
  setActiveCategory: (value: string) => void;
  setActiveBrand: (value: string) => void;
  clearFilters: () => void;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-full lg:hidden">
          <SlidersHorizontal className="mr-2 h-4 w-4" />
          Filter
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[80vh] rounded-t-3xl">
        <SheetHeader>
          <SheetTitle>Filter products</SheetTitle>
        </SheetHeader>
        <div className="space-y-5 overflow-y-auto py-6">
          <FilterSelect
            label="Category"
            value={activeCategory}
            options={categories}
            onChange={setActiveCategory}
          />
          <FilterSelect
            label="Brand"
            value={activeBrand}
            options={brands}
            onChange={setActiveBrand}
          />
        </div>
        <div className="flex gap-2">
          <SheetClose asChild>
            <Button variant="outline" className="flex-1 rounded-full" onClick={clearFilters}>
              Clear
            </Button>
          </SheetClose>
          <SheetClose asChild>
            <Button className="flex-1 rounded-full">Apply filters</Button>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}
function SectionHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#247a62]">{eyebrow}</p>
        <h2 className="mt-2 text-2xl font-black tracking-[-0.03em]">{title}</h2>
      </div>
      {action}
    </div>
  );
}
function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: Array<{
    label: string;
    to?: "/shop/wishlist" | "/shop/track" | "/shop/account";
    onClick?: () => void;
  }>;
}) {
  return (
    <div>
      <p className="text-sm font-semibold">{title}</p>
      <div className="mt-3 grid gap-2 text-sm text-white/60">
        {links.map((link) =>
          link.to ? (
            <Link key={link.label} to={link.to} className="text-left hover:text-white">
              {link.label}
            </Link>
          ) : (
            <button key={link.label} onClick={link.onClick} className="text-left hover:text-white">
              {link.label}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#cbd8cf] px-5 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e4f2e9] text-[#247a62]">
        <ShoppingBag className="h-5 w-5" />
      </div>
      <h3 className="mt-4 font-bold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
function ProductSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 pt-7 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="animate-pulse">
          <div className="aspect-[0.92] rounded-2xl bg-muted" />
          <div className="mt-3 h-3 w-1/3 rounded bg-muted" />
          <div className="mt-2 h-4 w-4/5 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}
function HeroFallback() {
  return (
    <div className="flex h-full w-full items-end bg-[#b8e7d0] p-8">
      <div className="max-w-xs text-5xl font-black leading-none tracking-[-0.06em] text-[#18211f]">
        GOOD
        <br />
        GEAR.
        <br />
        BETTER
        <br />
        DAYS.
      </div>
    </div>
  );
}
function uniqueValues(products: Product[], key: "category" | "brand") {
  return Array.from(
    new Set(
      products.map((product) => product[key]).filter((value): value is string => Boolean(value)),
    ),
  ).sort();
}
function priceOf(product: Product) {
  return Number(product.final_sell_mmk ?? product.price ?? 0);
}
function stockValue(product: Product) {
  return Math.max(0, (product.stock_in ?? 0) - (product.sold_qty ?? 0));
}
