import { createFileRoute, Outlet, Navigate, useRouterState } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { PWAStatus } from "@/components/PWAStatus";
import { NotificationBell } from "@/components/NotificationBell";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated")({ component: AuthLayout });

const titles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/rates": "Rates & Calculator",
  "/products": "Products",
  "/variants": "Bulk Variants",
  "/calculator": "Product Calculator",
  "/orders": "Orders",
  "/vouchers": "Vouchers",
  "/customers": "Customers",
  "/inventory": "Inventory",
  "/suppliers": "Suppliers",
  "/purchase-orders": "Purchase Orders",
  "/expenses": "Expenses & Profit",
  "/team": "Team & Roles",
  "/activity": "Activity Log",
  "/backup": "Backup & Restore",
  "/reports": "Sales Reports",
  "/analytics": "Analytics",
  "/exports": "Exports",
  "/content": "Content",
  "/settings": "Settings",
};

function AuthLayout() {
  const { session, loading } = useAuth();
  const path = useRouterState({ select: (r) => r.location.pathname });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-primary" />
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;

  const title = Object.entries(titles).find(([k]) => path.startsWith(k))?.[1] ?? "My Case";

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-muted/30">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur">
            <SidebarTrigger />
            <h1 className="flex-1 text-sm font-semibold">{title}</h1>
            <NotificationBell />
          </header>
          <main className="flex-1 p-4 md:p-6">
            <Outlet />
          </main>
          <PWAStatus />
        </div>
      </div>
    </SidebarProvider>
  );
}
