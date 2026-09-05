// Phase 16 — Recurring expenses & reminders (client-side, localStorage).
// Additive: stores templates locally; "Post now" inserts into expenses table.
import { useEffect, useMemo, useState } from "react";
import { Bell, Plus, Trash2, Repeat, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { formatKS } from "@/lib/format";
import { toast } from "sonner";

const CATEGORIES = ["rent", "salary", "ads", "shipping", "supplies", "utilities", "other"];
const KEY = "mycase.recurring_expenses.v1";

type Freq = "weekly" | "monthly";
type Template = {
  id: string;
  name: string;
  category: string;
  amount: number;
  frequency: Freq;
  day: number; // weekly: 0-6 (Sun=0); monthly: 1-31
  last_posted?: string; // YYYY-MM-DD
};

function load(): Template[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}
function save(list: Template[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

function nextDue(t: Template): Date {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (t.frequency === "weekly") {
    const diff = (t.day - d.getDay() + 7) % 7;
    d.setDate(d.getDate() + diff);
  } else {
    const day = Math.min(Math.max(t.day, 1), 28);
    d.setDate(day);
    if (d < now) d.setMonth(d.getMonth() + 1);
  }
  return d;
}

function isDue(t: Template): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (t.last_posted === today) return false;
  const due = nextDue(t);
  // Due if next due date is today or earlier (catching missed ones)
  const todayD = new Date();
  todayD.setHours(0, 0, 0, 0);
  return (
    due <= todayD ||
    (t.frequency === "monthly" &&
      new Date().getDate() >= Math.min(t.day, 28) &&
      t.last_posted !== today)
  );
}

const emptyForm: Partial<Template> = {
  name: "",
  category: "rent",
  amount: 0,
  frequency: "monthly",
  day: 1,
};

export function RecurringExpenses() {
  const qc = useQueryClient();
  const [list, setList] = useState<Template[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Template>>(emptyForm);

  useEffect(() => {
    setList(load());
  }, []);

  const due = useMemo(() => list.filter(isDue), [list]);

  const persist = (next: Template[]) => {
    setList(next);
    save(next);
  };

  const add = () => {
    if (!form.name || !form.amount) return toast.error("Name and amount required");
    const t: Template = {
      id: crypto.randomUUID(),
      name: form.name!,
      category: form.category!,
      amount: Number(form.amount),
      frequency: form.frequency as Freq,
      day: Number(form.day ?? 1),
    };
    persist([...list, t]);
    setOpen(false);
    setForm(emptyForm);
    toast.success("Recurring template added");
  };

  const remove = (id: string) => persist(list.filter((t) => t.id !== id));

  const postNow = async (t: Template) => {
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from("expenses").insert({
      category: t.category,
      amount: t.amount,
      note: `[Recurring] ${t.name}`,
      spent_at: today,
    } as any);
    if (error) return toast.error(error.message);
    persist(list.map((x) => (x.id === t.id ? { ...x, last_posted: today } : x)));
    qc.invalidateQueries({ queryKey: ["expenses"] });
    toast.success(`Posted: ${t.name}`);
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Repeat className="h-4 w-4" /> Recurring & Reminders
          {due.length > 0 && (
            <Badge variant="destructive" className="ml-2">
              <Bell className="mr-1 h-3 w-3" />
              {due.length} due
            </Badge>
          )}
        </CardTitle>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) setForm(emptyForm);
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Template
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New recurring expense</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input
                  value={form.name ?? ""}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Shop rent"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
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
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Frequency</Label>
                  <Select
                    value={form.frequency}
                    onValueChange={(v) =>
                      setForm({ ...form, frequency: v as Freq, day: v === "weekly" ? 1 : 1 })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>
                    {form.frequency === "weekly" ? "Day of week (0=Sun)" : "Day of month (1-28)"}
                  </Label>
                  <Input
                    type="number"
                    min={form.frequency === "weekly" ? 0 : 1}
                    max={form.frequency === "weekly" ? 6 : 28}
                    value={form.day ?? 1}
                    onChange={(e) => setForm({ ...form, day: Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={add}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-2">
        {list.length === 0 && (
          <p className="text-sm text-muted-foreground">No recurring templates yet.</p>
        )}
        {list.map((t) => {
          const dueNow = isDue(t);
          return (
            <div
              key={t.id}
              className={`flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 ${dueNow ? "border-amber-500/50 bg-amber-500/5" : ""}`}
            >
              <div className="min-w-0">
                <p className="font-medium truncate">
                  {t.name} <span className="text-xs text-muted-foreground">({t.category})</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatKS(t.amount)} ·{" "}
                  {t.frequency === "weekly" ? `Weekly (day ${t.day})` : `Monthly (day ${t.day})`}
                  {t.last_posted && ` · Last: ${t.last_posted}`}
                </p>
              </div>
              <div className="flex gap-1">
                {dueNow && (
                  <Button size="sm" onClick={() => postNow(t)}>
                    <Check className="mr-1 h-3 w-3" />
                    Post now
                  </Button>
                )}
                <Button size="icon" variant="ghost" onClick={() => remove(t.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
