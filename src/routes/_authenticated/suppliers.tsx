import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/suppliers")({ component: SuppliersPage });

type Supplier = {
  id: string;
  name: string;
  contact: string | null;
  address: string | null;
  note: string | null;
};
const empty: Partial<Supplier> = { name: "", contact: "", address: "", note: "" };

function SuppliersPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Supplier>>(empty);
  const [saving, setSaving] = useState(false);

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Supplier[];
    },
  });

  const save = async () => {
    const name = form.name?.trim() ?? "";
    if (!name) return toast.error("Supplier name is required");
    const payload = {
      name,
      contact: form.contact?.trim() || null,
      address: form.address?.trim() || null,
      note: form.note?.trim() || null,
    };
    setSaving(true);
    try {
      const request = form.id
        ? supabase.from("suppliers").update(payload).eq("id", form.id).select("id").single()
        : supabase.from("suppliers").insert(payload).select("id").single();
      const result = await Promise.race([
        request,
        new Promise<never>((_, reject) =>
          window.setTimeout(() => reject(new Error("Supplier save timed out. Please refresh and try again.")), 15000),
        ),
      ]);
      if (result.error) throw result.error;
      toast.success(form.id ? "Supplier updated" : "Supplier saved");
      setOpen(false);
      setForm({ ...empty });
      await qc.invalidateQueries({ queryKey: ["suppliers"] });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save supplier";
      toast.error(message.includes("row-level security") ? "Your account is not authorized to manage suppliers. Ask the admin to assign the Admin role." : message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete?")) return;
    await supabase.from("suppliers").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["suppliers"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) setForm(empty);
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={() => setForm(empty)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Supplier
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{form.id ? "Edit" : "New"} Supplier</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input
                  value={form.name ?? ""}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Contact (phone/line)</Label>
                <Input
                  value={form.contact ?? ""}
                  onChange={(e) => setForm({ ...form, contact: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Address</Label>
                <Textarea
                  value={form.address ?? ""}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Note</Label>
                <Textarea
                  value={form.note ?? ""}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {saving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th>Contact</th>
                <th>Address</th>
                <th>Note</th>
                <th className="px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No suppliers
                  </td>
                </tr>
              )}
              {suppliers.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td>{s.contact ?? "—"}</td>
                  <td className="text-muted-foreground">{s.address ?? "—"}</td>
                  <td className="text-muted-foreground">{s.note ?? "—"}</td>
                  <td className="px-4 text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setForm(s);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(s.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
