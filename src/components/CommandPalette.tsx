// Phase 12 — Global command palette (Cmd/Ctrl+K). Additive, no existing code changed.
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard, Package, ShoppingCart, Receipt, Users, Boxes, Truck, ClipboardList,
  Wallet, BarChart3, Settings, Search as SearchIcon, Activity, DatabaseBackup, Store,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/use-debounce";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/products", label: "Products", icon: Package },
  { to: "/orders", label: "Orders", icon: ShoppingCart },
  { to: "/vouchers", label: "Vouchers", icon: Receipt },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/inventory", label: "Inventory", icon: Boxes },
  { to: "/suppliers", label: "Suppliers", icon: Truck },
  { to: "/purchase-orders", label: "Purchase Orders", icon: ClipboardList },
  { to: "/expenses", label: "Expenses", icon: Wallet },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/activity", label: "Activity Log", icon: Activity },
  { to: "/backup", label: "Backup & Restore", icon: DatabaseBackup },
  { to: "/shop", label: "Public Shop", icon: Store },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const debounced = useDebounce(q, 200);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const { data: results } = useQuery({
    queryKey: ["cmdk-search", debounced],
    enabled: debounced.trim().length >= 2,
    queryFn: async () => {
      const term = debounced.trim();
      const [{ data: products }, { data: customers }, { data: orders }] = await Promise.all([
        supabase.from("products").select("id, name, product_code").ilike("name", `%${term}%`).limit(6),
        supabase.from("customers").select("id, name, phone").or(`name.ilike.%${term}%,phone.ilike.%${term}%`).limit(6),
        supabase.from("orders").select("id, order_no, customer_name").or(`customer_name.ilike.%${term}%`).limit(6),
      ]);
      return {
        products: products ?? [],
        customers: customers ?? [],
        orders: orders ?? [],
      };
    },
  });

  const go = (to: string) => {
    setOpen(false);
    setQ("");
    navigate({ to });
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search products, orders, customers… (Cmd/Ctrl+K)" value={q} onValueChange={setQ} />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {debounced.trim().length >= 2 && (
          <>
            {results?.products && results.products.length > 0 && (
              <CommandGroup heading="Products">
                {results.products.map((p: any) => (
                  <CommandItem key={`p-${p.id}`} onSelect={() => go(`/products`)} value={`product ${p.name}`}>
                    <Package className="mr-2 h-4 w-4" />
                    <span className="flex-1 truncate">{p.name}</span>
                    {p.product_code && <span className="text-xs text-muted-foreground">{p.product_code}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {results?.orders && results.orders.length > 0 && (
              <CommandGroup heading="Orders">
                {results.orders.map((o: any) => (
                  <CommandItem key={`o-${o.id}`} onSelect={() => go(`/orders`)} value={`order ${o.order_no} ${o.customer_name}`}>
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    <span className="flex-1 truncate">#{o.order_no} · {o.customer_name ?? "Guest"}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {results?.customers && results.customers.length > 0 && (
              <CommandGroup heading="Customers">
                {results.customers.map((c: any) => (
                  <CommandItem key={`c-${c.id}`} onSelect={() => go(`/customers/${c.id}`)} value={`customer ${c.name} ${c.phone ?? ""}`}>
                    <Users className="mr-2 h-4 w-4" />
                    <span className="flex-1 truncate">{c.name}</span>
                    {c.phone && <span className="text-xs text-muted-foreground">{c.phone}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="Pages">
          {navItems.map(({ to, label, icon: Icon }) => (
            <CommandItem key={to} onSelect={() => go(to)} value={`nav ${label}`}>
              <Icon className="mr-2 h-4 w-4" />
              {label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

/** Header trigger button. Click or Cmd/Ctrl+K to open. */
export function CommandPaletteTrigger() {
  return (
    <button
      onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
      className="hidden h-8 items-center gap-2 rounded-md border px-2 text-xs text-muted-foreground hover:bg-muted md:inline-flex"
      aria-label="Open command palette"
    >
      <SearchIcon className="h-3.5 w-3.5" />
      <span>Search…</span>
      <kbd className="ml-2 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
    </button>
  );
}
