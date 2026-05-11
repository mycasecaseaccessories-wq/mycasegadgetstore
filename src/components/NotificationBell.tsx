// Phase 10 — In-app notification bell (additive, read-only aggregation).
// Aggregates low-stock products + recent pending orders. No DB changes needed.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell, PackageX, ShoppingCart, CheckCircle2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime, formatKS } from "@/lib/format";

const READ_KEY = "notif-read-ids";

function readSet(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) ?? "[]")); }
  catch { return new Set(); }
}
function saveSet(s: Set<string>) {
  try { localStorage.setItem(READ_KEY, JSON.stringify([...s].slice(-500))); } catch {}
}

interface Notif {
  id: string;
  kind: "low-stock" | "out-of-stock" | "new-order";
  title: string;
  detail: string;
  time?: string;
  to: string;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState<Set<string>>(() => (typeof window !== "undefined" ? readSet() : new Set()));

  const { data: notifs = [] } = useQuery<Notif[]>({
    queryKey: ["notifications"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const out: Notif[] = [];

      const { data: products } = await supabase
        .from("products")
        .select("id, name, stock_in, sold_qty, low_stock_threshold, status")
        .eq("status", "ACTIVE");
      for (const p of products ?? []) {
        const remaining = Math.max(0, (p.stock_in ?? 0) - (p.sold_qty ?? 0));
        const threshold = p.low_stock_threshold ?? 5;
        if (remaining === 0) {
          out.push({
            id: `oos-${p.id}`,
            kind: "out-of-stock",
            title: `Out of stock: ${p.name}`,
            detail: "Restock to keep selling",
            to: "/inventory",
          });
        } else if (remaining <= threshold) {
          out.push({
            id: `low-${p.id}-${remaining}`,
            kind: "low-stock",
            title: `Low stock: ${p.name}`,
            detail: `${remaining} left (threshold ${threshold})`,
            to: "/inventory",
          });
        }
      }

      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { data: orders } = await supabase
        .from("orders")
        .select("id, order_no, customer_name, total, created_at, status")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(10);
      for (const o of orders ?? []) {
        out.push({
          id: `order-${o.id}`,
          kind: "new-order",
          title: `New order #${o.order_no}`,
          detail: `${o.customer_name ?? "Guest"} · ${formatKS(Number(o.total ?? 0))}`,
          time: o.created_at,
          to: "/orders",
        });
      }

      return out;
    },
  });

  const unread = notifs.filter((n) => !read.has(n.id));
  const markAll = () => {
    const next = new Set(read);
    notifs.forEach((n) => next.add(n.id));
    setRead(next);
    saveSet(next);
  };
  const markOne = (id: string) => {
    const next = new Set(read);
    next.add(id);
    setRead(next);
    saveSet(next);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label="Notifications"
          className="relative inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
        >
          <Bell className="h-4 w-4" />
          {unread.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
              {unread.length > 99 ? "99+" : unread.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-semibold">Notifications</p>
          {unread.length > 0 && (
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={markAll}>
              <CheckCircle2 className="mr-1 h-3 w-3" /> Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-96">
          {notifs.length === 0 && (
            <p className="px-3 py-8 text-center text-xs text-muted-foreground">You're all caught up</p>
          )}
          <ul className="divide-y">
            {notifs.map((n) => {
              const isRead = read.has(n.id);
              const Icon = n.kind === "new-order" ? ShoppingCart : PackageX;
              return (
                <li key={n.id}>
                  <Link
                    to={n.to}
                    onClick={() => { markOne(n.id); setOpen(false); }}
                    className={`flex items-start gap-2 px-3 py-2 text-xs hover:bg-muted/50 ${isRead ? "opacity-60" : ""}`}
                  >
                    <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${n.kind === "out-of-stock" ? "text-destructive" : n.kind === "low-stock" ? "text-amber-500" : "text-primary"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{n.title}</p>
                      <p className="truncate text-muted-foreground">{n.detail}</p>
                      {n.time && <p className="text-[10px] text-muted-foreground">{formatDateTime(n.time)}</p>}
                    </div>
                    {!isRead && <Badge variant="outline" className="h-4 px-1 text-[9px]">new</Badge>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
