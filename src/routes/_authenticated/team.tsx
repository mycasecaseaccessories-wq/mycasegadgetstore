import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/lib/roles";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/team")({ component: TeamPage });

function TeamPage() {
  const qc = useQueryClient();
  const { isAdmin, loading } = useRoles();

  const { data: rows = [] } = useQuery({
    queryKey: ["team-roles"],
    queryFn: async () => {
      const [{ data: roles }, { data: profiles }] = await Promise.all([
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("profiles").select("id, full_name"),
      ]);
      const map = new Map<string, { user_id: string; full_name: string | null; roles: string[] }>();
      for (const p of profiles ?? []) map.set(p.id, { user_id: p.id, full_name: p.full_name, roles: [] });
      for (const r of roles ?? []) {
        if (!map.has(r.user_id)) map.set(r.user_id, { user_id: r.user_id, full_name: null, roles: [] });
        map.get(r.user_id)!.roles.push(r.role);
      }
      return Array.from(map.values());
    },
  });

  const toggleAdmin = async (userId: string, makeAdmin: boolean) => {
    if (makeAdmin) {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "admin" });
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
      if (error) return toast.error(error.message);
    }
    toast.success("Updated");
    qc.invalidateQueries({ queryKey: ["team-roles"] });
  };

  if (loading) return <p className="p-8 text-center text-muted-foreground">Loading…</p>;
  if (!isAdmin) return <Card><CardContent className="p-8 text-center text-muted-foreground">Admin access required</CardContent></Card>;

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Team & Roles</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-3">User</th><th>Roles</th><th className="px-4 text-right">Actions</th></tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const isAdminRow = r.roles.includes("admin");
              return (
                <tr key={r.user_id} className="border-t">
                  <td className="px-4 py-3 font-medium">{r.full_name ?? r.user_id.slice(0, 8)}</td>
                  <td className="space-x-1">{r.roles.map(role => <Badge key={role} variant="outline" className={role === "admin" ? "bg-primary/10 text-primary" : ""}>{role}</Badge>)}</td>
                  <td className="px-4 text-right">
                    <Button size="sm" variant={isAdminRow ? "outline" : "default"} onClick={() => toggleAdmin(r.user_id, !isAdminRow)}>
                      {isAdminRow ? "Demote to staff" : "Promote to admin"}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
