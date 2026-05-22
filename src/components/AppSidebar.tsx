import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Package,
  Calculator,
  ShoppingCart,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Sparkles,
  Receipt,
  TrendingUp,
  PieChart,
  FileDown,
  StickyNote,
  Boxes,
  Layers,
  Wallet,
  Truck,
  ClipboardList,
  Shield,
  Store,
  Activity,
  DatabaseBackup,
  CreditCard,
  ShieldCheck,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useQuery } from "@tanstack/react-query";
import { signOut, useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { StorageImage } from "@/components/StorageImage";
import { useRoles } from "@/lib/roles";
import { supabase } from "@/integrations/supabase/client";

export function AppSidebar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useI18n();
  const { isAdmin } = useRoles();

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data } = await supabase.from("settings").select("*").limit(1).maybeSingle();
      return data;
    },
  });

  const items = [
    { title: t("nav.dashboard"), url: "/dashboard", icon: LayoutDashboard, admin: false },
    { title: t("nav.rates"), url: "/rates", icon: TrendingUp, admin: false },
    { title: t("nav.products"), url: "/products", icon: Package, admin: false },
    { title: t("nav.bulkVariants"), url: "/variants", icon: Layers, admin: false },
    { title: t("nav.calculator"), url: "/calculator", icon: Calculator, admin: false },
    { title: t("nav.orders"), url: "/orders", icon: ShoppingCart, admin: false },
    { title: t("nav.vouchers"), url: "/vouchers", icon: Receipt, admin: true },
    { title: t("nav.customers"), url: "/customers", icon: Users, admin: false },
    { title: t("nav.inventory"), url: "/inventory", icon: Boxes, admin: false },
    { title: t("nav.suppliers"), url: "/suppliers", icon: Truck, admin: false },
    { title: t("nav.po"), url: "/purchase-orders", icon: ClipboardList, admin: false },
    { title: "Ledger", url: "/ledger", icon: ClipboardList, admin: false },
    { title: "Payment Methods", url: "/payment-methods", icon: CreditCard, admin: true },
    { title: t("nav.expenses"), url: "/expenses", icon: Wallet, admin: true },
    { title: t("nav.reports"), url: "/reports", icon: BarChart3, admin: true },
    { title: t("nav.analytics"), url: "/analytics", icon: PieChart, admin: true },
    { title: t("nav.exports"), url: "/exports", icon: FileDown, admin: true },
    { title: t("nav.content"), url: "/content", icon: StickyNote, admin: false },
    { title: t("nav.storefront"), url: "/shop", icon: Store, admin: false },
    { title: t("nav.team"), url: "/team", icon: Shield, admin: true },
    { title: t("nav.activity"), url: "/activity", icon: Activity, admin: true },
    { title: t("nav.backup"), url: "/backup", icon: DatabaseBackup, admin: true },
    { title: "RLS Test", url: "/rls-test", icon: ShieldCheck, admin: true },
    { title: t("nav.settings"), url: "/settings", icon: Settings, admin: true },
  ].filter((i) => !i.admin || isAdmin);

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-3">
          <StorageImage
            src={settings?.logo_url}
            alt=""
            className="h-9 w-9 rounded-lg object-cover shadow-sm"
            fallback={
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-sm">
                <Sparkles className="h-4 w-4" />
              </div>
            }
          />
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold">{settings?.business_name || "My Case"}</span>
            <span className="text-xs text-muted-foreground">Admin Console</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = path === item.url || path.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center gap-2 px-2 py-2 group-data-[collapsible=icon]:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
            {user?.email?.[0]?.toUpperCase() ?? "A"}
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-xs font-medium">{user?.email}</span>
            <span className="text-[10px] text-muted-foreground">Administrator</span>
          </div>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} tooltip={t("common.signOut")}>
              <LogOut className="h-4 w-4" />
              <span>{t("common.signOut")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
