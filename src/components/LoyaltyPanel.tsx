// Phase 19 — Loyalty admin panel: configure rules, view/adjust customer points (Supabase-backed).
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, Plus, Minus, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  getConfig,
  setConfig,
  getAllBalances,
  adjust,
  setBalance,
  customerKey,
  onLoyaltyChange,
  type LoyaltyConfig,
} from "@/lib/loyalty";
import { toast } from "sonner";

export function LoyaltyPanel() {
  const qc = useQueryClient();
  const [cfg, setCfg] = useState<LoyaltyConfig>(getConfig());

  const { data: customers = [] } = useQuery({
    queryKey: ["customers", "loyalty"],
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("id, name, phone").order("name");
      return data ?? [];
    },
  });

  const { data: balanceRows = [] } = useQuery({
    queryKey: ["loyalty_balances"],
    queryFn: getAllBalances,
  });

  const balances: Record<string, number> = {};
  for (const r of balanceRows) balances[r.customer_key] = Number(r.points ?? 0);

  useEffect(() => {
    const off = onLoyaltyChange(() => qc.invalidateQueries({ queryKey: ["loyalty_balances"] }));
    return () => {
      off();
    };
  }, [qc]);

  const save = () => {
    setConfig(cfg);
    toast.success("Loyalty rules saved");
  };

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-base">
          <Award className="h-4 w-4" /> Customer Loyalty
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <p className="text-sm font-medium">Enable loyalty program</p>
            <p className="text-xs text-muted-foreground">Award points on each paid order.</p>
          </div>
          <Switch checked={cfg.enabled} onCheckedChange={(v) => setCfg({ ...cfg, enabled: v })} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Earn 1 point per</Label>
            <Input
              type="number"
              value={cfg.earnPerAmount}
              onChange={(e) => setCfg({ ...cfg, earnPerAmount: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">1 point = (currency)</Label>
            <Input
              type="number"
              value={cfg.redeemValue}
              onChange={(e) => setCfg({ ...cfg, redeemValue: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Min points to redeem</Label>
            <Input
              type="number"
              value={cfg.minRedeem}
              onChange={(e) => setCfg({ ...cfg, minRedeem: Number(e.target.value) })}
            />
          </div>
        </div>
        <Button size="sm" onClick={save}>
          <Save className="mr-2 h-4 w-4" />
          Save rules
        </Button>

        <div className="rounded-md border">
          <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Customer balances
            </p>
            <Badge variant="outline">{customers.length} customers</Badge>
          </div>
          <div className="max-h-80 divide-y overflow-y-auto">
            {customers.length === 0 && (
              <p className="p-4 text-center text-xs text-muted-foreground">No customers yet</p>
            )}
            {customers.map((c) => {
              const k = customerKey(c);
              const bal = balances[k] ?? 0;
              return (
                <div key={c.id} className="flex items-center gap-2 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.phone ?? "—"}</p>
                  </div>
                  <Badge className="font-mono">{bal} pts</Badge>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    onClick={() =>
                      adjust(k, 10).then(() =>
                        qc.invalidateQueries({ queryKey: ["loyalty_balances"] }),
                      )
                    }
                    title="+10"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    onClick={() =>
                      adjust(k, -10).then(() =>
                        qc.invalidateQueries({ queryKey: ["loyalty_balances"] }),
                      )
                    }
                    title="-10"
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <Input
                    type="number"
                    className="h-7 w-20 text-xs"
                    placeholder="set"
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (!Number.isNaN(v) && e.target.value !== "") {
                        setBalance(k, v).then(() =>
                          qc.invalidateQueries({ queryKey: ["loyalty_balances"] }),
                        );
                        e.target.value = "";
                      }
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
