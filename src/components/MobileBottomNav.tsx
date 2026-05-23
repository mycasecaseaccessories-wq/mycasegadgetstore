// Phase 11 — Mobile bottom navigation. Shown on small screens only.
// Sidebar still available via SidebarTrigger; this is an additive shortcut.
import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Package, ShoppingCart, Receipt, Boxes } from "lucide-react";
import { useRoles } from "@/lib/roles";

const items = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/products", label: "Products", icon: Package },
  { to: "/orders", label: "Orders", icon: ShoppingCart },
  { to: "/vouchers", label: "Vouchers", icon: Receipt },
  { to: "/inventory", label: "Stock", icon: Boxes },
];

export function MobileBottomNav() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { isAdmin, loading: rolesLoading } = useRoles();
  const visibleItems = items.filter((item) => item.to !== "/vouchers" || isAdmin || rolesLoading);
  return (
    <nav
      className="sticky bottom-0 z-30 flex h-14 items-stretch justify-around border-t bg-background/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {visibleItems.map(({ to, label, icon: Icon }) => {
        const active = path === to || path.startsWith(to + "/");
        return (
          <Link
            key={to}
            to={to}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] transition-colors ${
              active ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className={`h-5 w-5 ${active ? "scale-110" : ""} transition-transform`} />
            <span className="font-medium">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
