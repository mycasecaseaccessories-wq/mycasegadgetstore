import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/lib/roles";
import { formatDateTime } from "@/lib/format";
import { Activity, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/activity")({ component: ActivityPage });

const PAGE_SIZE = 50;

function ActivityPage() {
  const qc = useQueryClient();
  const { isAdmin, loading } = useRoles();
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [page, setPage] = useState(0);

  const { data, isFetching } = useQuery({
    queryKey: ["activity-logs", page, actionFilter, search],
    enabled: isAdmin,
    queryFn: async () => {
      let q = supabase
        .from("activity_logs" as any)
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (actionFilter !== "all") q = q.like("action", `${actionFilter}%`);
      if (search.trim())
        q = q.or(
          `summary.ilike.%${search}%,user_name.ilike.%${search}%,entity_id.ilike.%${search}%`,
        );
      const { data, count, error } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as any[], total: count ?? 0 };
    },
  });

  if (loading) return <p className="p-8 text-center text-muted-foreground">Loading…</p>;
  if (!isAdmin)
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Admin access required
        </CardContent>
      </Card>
    );

  const total = data?.total ?? 0;
  const rows = data?.rows ?? [];
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 border-b">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4" /> Activity Log
          <Badge variant="outline" className="ml-2">
            {total.toLocaleString()}
          </Badge>
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search…"
            value={search}
            onChange={(e) => {
              setPage(0);
              setSearch(e.target.value);
            }}
            className="h-8 w-44"
          />
          <Select
            value={actionFilter}
            onValueChange={(v) => {
              setPage(0);
              setActionFilter(v);
            }}
          >
            <SelectTrigger className="h-8 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              <SelectItem value="order">Orders</SelectItem>
              <SelectItem value="voucher">Vouchers</SelectItem>
              <SelectItem value="product">Products</SelectItem>
              <SelectItem value="po">Purchase Orders</SelectItem>
              <SelectItem value="expense">Expenses</SelectItem>
              <SelectItem value="auth">Auth</SelectItem>
              <SelectItem value="settings">Settings</SelectItem>
              <SelectItem value="role">Roles</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            onClick={() => qc.invalidateQueries({ queryKey: ["activity-logs"] })}
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">When</th>
              <th>User</th>
              <th>Action</th>
              <th>Entity</th>
              <th className="px-4">Summary</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  No activity recorded
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t hover:bg-muted/20">
                <td className="px-4 py-2 whitespace-nowrap text-xs text-muted-foreground">
                  {formatDateTime(r.created_at)}
                </td>
                <td className="text-xs">{r.user_name ?? "—"}</td>
                <td>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {r.action}
                  </Badge>
                </td>
                <td className="text-xs">
                  {r.entity_type ? `${r.entity_type}${r.entity_id ? `#${r.entity_id}` : ""}` : "—"}
                </td>
                <td className="px-4 text-xs">{r.summary ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
          <span>
            Page {page + 1} / {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Prev
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
