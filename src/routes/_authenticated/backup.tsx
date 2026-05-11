// Phase 9 — Backup & Restore (admin-only). Additive page, no existing code touched.
import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/lib/roles";
import { logActivity } from "@/lib/activity";
import { Download, Upload, Database, ShieldAlert, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/backup")({ component: BackupPage });

// Tables that are safe to back up (excludes auth / role tables).
const TABLES = [
  "settings", "rates", "products", "product_variants",
  "customers", "suppliers",
  "orders", "order_items",
  "vouchers", "purchase_orders", "purchase_order_items",
  "expenses", "notes",
] as const;

type TableName = typeof TABLES[number];

interface Backup {
  version: 1;
  exported_at: string;
  app: "my-case";
  tables: Record<string, any[]>;
}

function BackupPage() {
  const { isAdmin, loading } = useRoles();
  const [busy, setBusy] = useState<null | "export" | "import">(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  if (loading) return <p className="p-8 text-center text-muted-foreground">Loading…</p>;
  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
          <ShieldAlert className="h-8 w-8" />
          <p>Admin access required</p>
        </CardContent>
      </Card>
    );
  }

  const handleExport = async () => {
    setBusy("export");
    try {
      const tables: Record<string, any[]> = {};
      const c: Record<string, number> = {};
      for (const t of TABLES) {
        const { data, error } = await supabase.from(t).select("*");
        if (error) throw error;
        tables[t] = data ?? [];
        c[t] = (data ?? []).length;
      }
      setCounts(c);
      const backup: Backup = {
        version: 1,
        exported_at: new Date().toISOString(),
        app: "my-case",
        tables,
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mycase-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      const total = Object.values(c).reduce((s, n) => s + n, 0);
      toast.success(`Exported ${total.toLocaleString()} rows`);
      logActivity({ action: "backup.export", summary: `Backup exported (${total} rows)` });
    } catch (e: any) {
      toast.error("Export failed", { description: e?.message });
    } finally {
      setBusy(null);
    }
  };

  const handleImport = async (file: File) => {
    if (!confirm("Restore from backup? Existing rows with matching IDs will be overwritten. Continue?")) return;
    setBusy("import");
    try {
      const text = await file.text();
      const backup = JSON.parse(text) as Backup;
      if (backup.app !== "my-case" || backup.version !== 1) throw new Error("Invalid backup file");

      const c: Record<string, number> = {};
      // Restore in dependency order (parents first).
      for (const t of TABLES) {
        const rows = backup.tables[t];
        if (!rows || rows.length === 0) { c[t] = 0; continue; }
        // Upsert in chunks of 500 to stay within payload limits.
        for (let i = 0; i < rows.length; i += 500) {
          const chunk = rows.slice(i, i + 500);
          const { error } = await supabase.from(t).upsert(chunk, { onConflict: "id" });
          if (error) throw new Error(`${t}: ${error.message}`);
        }
        c[t] = rows.length;
      }
      setCounts(c);
      const total = Object.values(c).reduce((s, n) => s + n, 0);
      toast.success(`Restored ${total.toLocaleString()} rows`);
      logActivity({ action: "backup.import", summary: `Backup restored (${total} rows)` });
    } catch (e: any) {
      toast.error("Restore failed", { description: e?.message });
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4" /> Backup & Restore
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <p className="text-sm text-muted-foreground">
            Export a full snapshot of your business data as a JSON file, or restore from a previous backup.
            Auth users and roles are <strong>not</strong> included for security.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleExport} disabled={busy !== null}>
              {busy === "export" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Export backup
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy !== null}>
              {busy === "import" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Restore from file
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImport(f);
              }}
            />
          </div>

          {Object.keys(counts).length > 0 && (
            <div className="rounded-md border p-3">
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Last operation</p>
              <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-3">
                {Object.entries(counts).map(([t, n]) => (
                  <div key={t} className="flex items-center justify-between rounded bg-muted/40 px-2 py-1">
                    <span className="font-mono">{t}</span>
                    <Badge variant="outline">{n}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
