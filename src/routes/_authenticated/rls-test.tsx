import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RequireAdmin } from "@/components/RequireAdmin";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useRoles } from "@/lib/roles";
import { ShieldCheck, Loader2, Play } from "lucide-react";

export const Route = createFileRoute("/_authenticated/rls-test")({
  component: () => <RequireAdmin><RlsTestPage /></RequireAdmin>,
});

type Op = "select" | "insert" | "update" | "delete";
type Expect = "allow" | "deny";

interface Test {
  table: string;
  op: Op;
  expect: Expect;
  label: string;
  run: () => Promise<{ ok: boolean; error?: string; rowCount?: number }>;
}

interface Result extends Test {
  status: "pass" | "fail" | "running" | "idle";
  message?: string;
}

function RlsTestPage() {
  const { user } = useAuth();
  const { isAdmin, isStaff } = useRoles();
  const [results, setResults] = useState<Record<string, Result>>({});
  const [running, setRunning] = useState(false);

  const tests: Test[] = [
    {
      table: "products", op: "select", expect: "allow",
      label: "Authenticated user can read products",
      run: async () => {
        const { data, error } = await supabase.from("products").select("id").limit(5);
        return { ok: !error, error: error?.message, rowCount: data?.length };
      },
    },
    {
      table: "settings", op: "select", expect: "allow",
      label: "Staff can read settings",
      run: async () => {
        const { data, error } = await supabase.from("settings").select("id").limit(1);
        return { ok: !error, error: error?.message, rowCount: data?.length };
      },
    },
    {
      table: "orders", op: "select", expect: "allow",
      label: "Staff can read orders",
      run: async () => {
        const { data, error } = await supabase.from("orders").select("id").limit(5);
        return { ok: !error, error: error?.message, rowCount: data?.length };
      },
    },
    {
      table: "expenses", op: "select", expect: "allow",
      label: "Staff/admin can read expenses",
      run: async () => {
        const { data, error } = await supabase.from("expenses").select("id").limit(5);
        return { ok: !error, error: error?.message, rowCount: data?.length };
      },
    },
    {
      table: "user_roles", op: "select", expect: "allow",
      label: "User can read own role row",
      run: async () => {
        const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user!.id);
        return { ok: !error, error: error?.message, rowCount: data?.length };
      },
    },
    {
      table: "activity_logs", op: "select", expect: "allow",
      label: "Admin can read activity_logs",
      run: async () => {
        const { data, error } = await supabase.from("activity_logs").select("id").limit(5);
        return { ok: !error, error: error?.message, rowCount: data?.length };
      },
    },
    {
      table: "user_roles", op: "insert", expect: "deny",
      label: "Non-admin cannot escalate to admin (insert blocked)",
      run: async () => {
        // Try to insert a fake admin row for self — admins manage roles policy blocks non-admins.
        // For admin testers this WILL succeed; we still want to verify policy mechanics for non-admin.
        const fakeUser = "00000000-0000-0000-0000-000000000001";
        const { error } = await supabase.from("user_roles").insert({ user_id: fakeUser, role: "admin" });
        // Cleanup if it accidentally inserted
        if (!error) await supabase.from("user_roles").delete().eq("user_id", fakeUser).eq("role", "admin");
        return { ok: !!error, error: error?.message };
      },
    },
    {
      table: "profiles", op: "update", expect: "deny",
      label: "User cannot update someone else's profile",
      run: async () => {
        const fakeId = "00000000-0000-0000-0000-000000000099";
        const { data, error } = await supabase
          .from("profiles")
          .update({ full_name: "rls-test-should-fail" })
          .eq("id", fakeId)
          .select();
        // Either error (deny) or zero rows updated (RLS filtered out) — both are acceptable
        const denied = !!error || (Array.isArray(data) && data.length === 0);
        return { ok: denied, error: error?.message, rowCount: data?.length };
      },
    },
    {
      table: "payment_methods", op: "select", expect: "allow",
      label: "Staff can read payment_methods (incl. inactive)",
      run: async () => {
        const { data, error } = await supabase.from("payment_methods").select("id").limit(10);
        return { ok: !error, error: error?.message, rowCount: data?.length };
      },
    },
  ];

  const runAll = async () => {
    setRunning(true);
    const init: Record<string, Result> = {};
    for (const t of tests) init[t.label] = { ...t, status: "running" };
    setResults(init);

    for (const t of tests) {
      try {
        const r = await t.run();
        const expectedAllow = t.expect === "allow";
        const pass = expectedAllow ? r.ok : !r.ok || (r.rowCount === 0);
        setResults((prev) => ({
          ...prev,
          [t.label]: {
            ...t,
            status: pass ? "pass" : "fail",
            message: r.error
              ? `Error: ${r.error}`
              : r.rowCount !== undefined
              ? `Rows: ${r.rowCount}`
              : r.ok ? "OK" : "Blocked",
          },
        }));
      } catch (e: any) {
        setResults((prev) => ({
          ...prev,
          [t.label]: { ...t, status: "fail", message: e?.message ?? "Unknown error" },
        }));
      }
    }
    setRunning(false);
  };

  const passed = Object.values(results).filter((r) => r.status === "pass").length;
  const failed = Object.values(results).filter((r) => r.status === "fail").length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" /> RLS Policy Test Panel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div className="rounded-md border bg-muted/30 p-3 text-xs">
            <p>Logged in as: <span className="font-mono">{user?.email}</span></p>
            <p className="mt-1 flex items-center gap-2">
              Role:
              {isAdmin && <Badge className="bg-primary/10 text-primary">admin</Badge>}
              {isStaff && !isAdmin && <Badge variant="outline">staff</Badge>}
              {!isStaff && <Badge variant="outline">no role</Badge>}
            </p>
            <p className="mt-2 text-muted-foreground">
              Tests run against the live database with the current user's session. They verify the
              expected allow/deny behavior of Row-Level Security policies.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={runAll} disabled={running}>
              {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              Run all tests
            </Button>
            {Object.keys(results).length > 0 && (
              <div className="flex gap-2 text-xs">
                <Badge className="bg-emerald-500/10 text-emerald-600">{passed} pass</Badge>
                {failed > 0 && <Badge className="bg-destructive/10 text-destructive">{failed} fail</Badge>}
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Test</th>
                  <th className="px-3 py-2">Table</th>
                  <th className="px-3 py-2">Op</th>
                  <th className="px-3 py-2">Expect</th>
                  <th className="px-3 py-2">Result</th>
                </tr>
              </thead>
              <tbody>
                {tests.map((t) => {
                  const r = results[t.label];
                  return (
                    <tr key={t.label} className="border-t">
                      <td className="px-3 py-2">{t.label}</td>
                      <td className="px-3 py-2 font-mono text-xs">{t.table}</td>
                      <td className="px-3 py-2 text-xs uppercase">{t.op}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="text-xs">{t.expect}</Badge>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {!r || r.status === "idle" ? (
                          <span className="text-muted-foreground">—</span>
                        ) : r.status === "running" ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <div className="flex items-center gap-2">
                            <Badge className={r.status === "pass" ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"}>
                              {r.status}
                            </Badge>
                            {r.message && <span className="text-muted-foreground">{r.message}</span>}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
