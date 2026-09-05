import { createFileRoute } from "@tanstack/react-router";
import { RequireAdmin } from "@/components/RequireAdmin";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatKS } from "@/lib/format";
import { toast } from "sonner";
import { RecurringExpenses } from "@/components/RecurringExpenses";

export const Route = createFileRoute("/_authenticated/expenses")({
  component: () => (
    <RequireAdmin>
      <ExpensesPage />
    </RequireAdmin>
  ),
});

const CATEGORIES = ["rent", "salary", "ads", "shipping", "supplies", "utilities", "other"];

type Expense = {
  id: string;
  category: string;
  amount: number;
  note: string | null;
  spent_at: string;
};
const empty: Partial<Expense> = {
  category: "other",
  amount: 0,
  note: "",
  spent_at: new Date().toISOString().slice(0, 10),
};

function ExpensesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Expense>>(empty);

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .order("spent_at", { ascending: false });
      if (error) throw error;
      return data as Expense[];
    },
  });

  const { data: revenue = 0 } = useQuery({
    queryKey: ["revenue-total"],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("total, status")
        .neq("status", "cancelled");
      return (data ?? []).reduce((s, o) => s + Number(o.total), 0);
    },
  });

  const totalExpense = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const profit = revenue - totalExpense;

  const byCat = expenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + Number(e.amount);
    return acc;
  }, {});

  const save = async () => {
    if (!form.amount || form.amount <= 0) return toast.error("Amount required");
    const payload = { ...form, amount: Number(form.amount) };
    const { error } = form.id
      ? await supabase.from("expenses").update(payload).eq("id", form.id)
      : await supabase.from("expenses").insert(payload as any);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setOpen(false);
    setForm(empty);
    qc.invalidateQueries({ queryKey: ["expenses"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete?")) return;
    await supabase.from("expenses").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["expenses"] });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Revenue</p>
            <p className="mt-1 text-xl font-bold text-green-600">{formatKS(revenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Expenses</p>
            <p className="mt-1 text-xl font-bold text-red-600">{formatKS(totalExpense)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Net Profit</p>
            <p
              className={`mt-1 text-xl font-bold ${profit >= 0 ? "text-primary" : "text-red-600"}`}
            >
              {formatKS(profit)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">By Category</CardTitle>
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) setForm(empty);
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => setForm(empty)}>
                <Plus className="mr-2 h-4 w-4" />
                Add
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{form.id ? "Edit" : "New"} Expense</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select
                    value={form.category}
                    onValueChange={(v) => setForm({ ...form, category: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Amount (KS)</Label>
                  <Input
                    type="number"
                    value={form.amount ?? 0}
                    onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={form.spent_at ?? ""}
                    onChange={(e) => setForm({ ...form, spent_at: e.target.value })}
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
                <Button onClick={save}>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {Object.entries(byCat).map(([k, v]) => (
            <div key={k} className="rounded-md border p-3">
              <p className="text-xs uppercase text-muted-foreground">{k}</p>
              <p className="mt-1 font-semibold">{formatKS(v)}</p>
            </div>
          ))}
          {Object.keys(byCat).length === 0 && (
            <p className="col-span-full text-sm text-muted-foreground">No expenses yet</p>
          )}
        </CardContent>
      </Card>

      <RecurringExpenses />

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th>Category</th>
                <th>Note</th>
                <th className="text-right">Amount</th>
                <th className="px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No expenses
                  </td>
                </tr>
              )}
              {expenses.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="px-4 py-2.5">{e.spent_at}</td>
                  <td className="capitalize">{e.category}</td>
                  <td className="text-muted-foreground">{e.note ?? "—"}</td>
                  <td className="text-right font-medium">{formatKS(Number(e.amount))}</td>
                  <td className="px-4 text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setForm(e);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(e.id)}>
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
