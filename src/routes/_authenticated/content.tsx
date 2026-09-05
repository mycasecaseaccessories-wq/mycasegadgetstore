import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pin, PinOff, Plus, Trash2, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/content")({ component: ContentPage });

type Note = {
  id: string;
  title: string;
  body: string | null;
  pinned: boolean;
  created_at: string;
  updated_at: string;
};

function ContentPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [search, setSearch] = useState("");

  const { data: notes = [] } = useQuery({
    queryKey: ["notes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .order("pinned", { ascending: false })
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Note[];
    },
  });

  const filtered = notes.filter(
    (n) =>
      !search ||
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      (n.body ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  const openNew = () => {
    setEditing(null);
    setTitle("");
    setBody("");
    setOpen(true);
  };
  const openEdit = (n: Note) => {
    setEditing(n);
    setTitle(n.title);
    setBody(n.body ?? "");
    setOpen(true);
  };

  const save = async () => {
    if (!title.trim()) {
      toast.error("Title required");
      return;
    }
    if (editing) {
      const { error } = await supabase.from("notes").update({ title, body }).eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("notes").insert({ title, body });
      if (error) return toast.error(error.message);
    }
    toast.success("Saved");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["notes"] });
  };

  const togglePin = async (n: Note) => {
    await supabase.from("notes").update({ pinned: !n.pinned }).eq("id", n.id);
    qc.invalidateQueries({ queryKey: ["notes"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete note?")) return;
    await supabase.from("notes").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["notes"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search notes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Button onClick={openNew} className="ml-auto">
          <Plus className="mr-2 h-4 w-4" />
          New Note
        </Button>
      </div>

      {filtered.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            No notes yet. Click "New Note" to capture announcements, policies, or quick references.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((n) => (
          <Card key={n.id} className={n.pinned ? "border-primary/50" : ""}>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-start gap-2">
                <h3 className="flex-1 font-semibold leading-tight">{n.title}</h3>
                {n.pinned && <Pin className="h-4 w-4 text-primary" />}
              </div>
              {n.body && (
                <p className="line-clamp-6 whitespace-pre-wrap text-sm text-muted-foreground">
                  {n.body}
                </p>
              )}
              <p className="text-[10px] text-muted-foreground">{formatDateTime(n.updated_at)}</p>
              <div className="flex gap-1 pt-1">
                <Button size="sm" variant="ghost" onClick={() => togglePin(n)}>
                  {n.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => openEdit(n)}>
                  <Edit3 className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(n.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit note" : "New note"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea
              placeholder="Write your note..."
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
