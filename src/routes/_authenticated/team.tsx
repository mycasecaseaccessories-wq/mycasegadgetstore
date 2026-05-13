import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/lib/roles";
import { toast } from "sonner";
import { inviteStaff, removeTeamMember } from "@/lib/team.functions";
import { UserPlus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/team")({ component: TeamPage });

function TeamPage() {
  const qc = useQueryClient();
  const { isAdmin, loading } = useRoles();
  const invite = useServerFn(inviteStaff);
  const remove = useServerFn(removeTeamMember);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", password: "", role: "staff" as "staff" | "admin" });

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

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await invite({ data: form });
      toast.success(`Invited ${form.email}`);
      setOpen(false);
      setForm({ fullName: "", email: "", password: "", role: "staff" });
      qc.invalidateQueries({ queryKey: ["team-roles"] });
    } catch (err: any) {
      toast.error(err?.message || "Invite failed");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (userId: string, name: string) => {
    if (!confirm(`Remove ${name}? This deletes the account.`)) return;
    try {
      await remove({ data: { userId } });
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["team-roles"] });
    } catch (err: any) {
      toast.error(err?.message || "Remove failed");
    }
  };

  if (loading) return <p className="p-8 text-center text-muted-foreground">Loading…</p>;
  if (!isAdmin) return <Card><CardContent className="p-8 text-center text-muted-foreground">Admin access required</CardContent></Card>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Team & Roles</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><UserPlus className="mr-2 h-4 w-4" />Invite staff</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Invite a new team member</DialogTitle></DialogHeader>
            <form onSubmit={handleInvite} className="space-y-3">
              <div>
                <Label>Full name</Label>
                <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required maxLength={100} />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required maxLength={255} />
              </div>
              <div>
                <Label>Temporary password</Label>
                <Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} maxLength={128} placeholder="Min 8 characters" />
                <p className="mt-1 text-xs text-muted-foreground">Share this with the new member; they can change it after sign-in.</p>
              </div>
              <div>
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as "staff" | "admin" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={busy}>{busy ? "Inviting…" : "Invite"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-3">User</th><th>Roles</th><th className="px-4 text-right">Actions</th></tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const isAdminRow = r.roles.includes("admin");
              const name = r.full_name ?? r.user_id.slice(0, 8);
              return (
                <tr key={r.user_id} className="border-t">
                  <td className="px-4 py-3 font-medium">{name}</td>
                  <td className="space-x-1">{r.roles.length === 0 ? <Badge variant="outline">no role</Badge> : r.roles.map(role => <Badge key={role} variant="outline" className={role === "admin" ? "bg-primary/10 text-primary" : ""}>{role}</Badge>)}</td>
                  <td className="px-4 text-right space-x-2">
                    <Button size="sm" variant={isAdminRow ? "outline" : "default"} onClick={() => toggleAdmin(r.user_id, !isAdminRow)}>
                      {isAdminRow ? "Demote to staff" : "Promote to admin"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleRemove(r.user_id, name)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
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
