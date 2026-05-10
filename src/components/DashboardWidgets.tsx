// Phase 6 — Additive dashboard widgets. Standalone, no edits to existing queries.
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Activity as ActivityIcon, PackageX, Boxes } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/lib/roles";
import { formatKS, formatDateTime } from "@/lib/format";

export function DashboardWidgets() {
  const { isAdmin } = useRoles();

  const { data: inv } = useQuery({
    queryKey: ["dash-inventory"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, stock_in, sold_qty, low_stock_threshold, final_sell_mmk, status")
        .eq("status", "ACTIVE");
      const rows = data ?? [];
      const items = rows.map((p: any) => {
        const remaining = Math.max(0, (p.stock_in ?? 0) - (p.sold_qty ?? 0));
        return { ...p, remaining };
      });
      const low = items
        .filter((p) => p.remaining <= (p.low_stock_threshold ?? 5))
        .sort((a, b) => a.remaining - b.remaining)
        .slice(0, 6);
      const outOfStock = items.filter((p) => p.remaining === 0).length;
      const stockValue = items.reduce((s, p) => s + p.remaining * Number(p.final_sell_mmk ?? 0), 0);
      return { low, outOfStock, totalProducts: items.length, stockValue };
    },
  });

  const { data: recent } = useQuery({
    queryKey: ["dash-activity"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_logs" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(8);
      return (data ?? []) as any[];
    },
  });

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Boxes className="h-4 w-4 text-primary" /> Inventory Health
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-4 text-sm">
          <Row label="Active products" value={(inv?.totalProducts ?? 0).toString()} />
          <Row label="Out of stock" value={(inv?.outOfStock ?? 0).toString()} accent={inv?.outOfStock ? "text-destructive" : ""} />
          <Row label="Stock value" value={formatKS(inv?.stockValue ?? 0)} />
          <Link to="/inventory" className="mt-2 inline-block text-xs text-primary hover:underline">View inventory →</Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Low-stock Alerts
          </CardTitle>
          <Badge variant="outline" className="text-[10px]">{inv?.low.length ?? 0}</Badge>
        </CardHeader>
        <CardContent className="pt-3 text-sm">
          {(!inv?.low || inv.low.length === 0) && (
            <p className="py-6 text-center text-xs text-muted-foreground">All stock levels are healthy</p>
          )}
          <ul className="space-y-1.5">
            {inv?.low.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 rounded px-2 py-1.5 hover:bg-muted/40">
                <span className="flex items-center gap-2 truncate">
                  {p.remaining === 0 && <PackageX className="h-3 w-3 text-destructive" />}
                  <span className="truncate">{p.name}</span>
                </span>
                <Badge variant={p.remaining === 0 ? "destructive" : "outline"} className="text-[10px]">
                  {p.remaining} left
                </Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between border-b pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ActivityIcon className="h-4 w-4 text-primary" /> Recent Activity
            </CardTitle>
            <Link to="/activity" className="text-xs text-primary hover:underline">View all</Link>
          </CardHeader>
          <CardContent className="pt-3 text-sm">
            {(!recent || recent.length === 0) && (
              <p className="py-6 text-center text-xs text-muted-foreground">No activity yet</p>
            )}
            <ul className="space-y-2">
              {recent?.map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-2 text-xs">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.summary ?? r.action}</p>
                    <p className="text-[10px] text-muted-foreground">{r.user_name ?? "—"} · {formatDateTime(r.created_at)}</p>
                  </div>
                  <Badge variant="outline" className="font-mono text-[9px]">{r.action}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value, accent = "" }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`font-semibold ${accent}`}>{value}</span>
    </div>
  );
}
