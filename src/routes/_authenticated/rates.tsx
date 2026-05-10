import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { Plus, Trash2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatKS } from "@/lib/format";
import { calculatePricing, type ProfitMode, type RoundingRule, type MinimumPriceMode } from "@/lib/pricing";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/rates")({ component: RatesPage });

type Rate = { id: string; date: string; source: string; buy_rate: number; sell_gap: number; note: string | null };

function RatesPage() {
  const qc = useQueryClient();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [source, setSource] = useState("THB");
  const [buyRate, setBuyRate] = useState<number>(0);
  const [sellGap, setSellGap] = useState<number>(0);
  const [note, setNote] = useState("");

  const { data: rates = [] } = useQuery({
    queryKey: ["rates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rates").select("*").order("date", { ascending: false }).limit(100);
      if (error) throw error;
      return data as Rate[];
    },
  });

  const latest = rates[0];
  useEffect(() => {
    if (latest && buyRate === 0) {
      setBuyRate(Number(latest.buy_rate));
      setSellGap(Number(latest.sell_gap));
      setSource(latest.source);
    }
  }, [latest]); // eslint-disable-line

  const addRate = async () => {
    if (buyRate <= 0) return toast.error("Buy rate required");
    const { error } = await supabase.from("rates").insert({ date, source, buy_rate: buyRate, sell_gap: sellGap, note: note || null });
    if (error) return toast.error(error.message);
    toast.success("Rate saved");
    setNote("");
    qc.invalidateQueries({ queryKey: ["rates"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete rate?")) return;
    await supabase.from("rates").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["rates"] });
  };

  // Calculator
  const [thb, setThb] = useState(0);
  const [cargo, setCargo] = useState(0);
  const [deli, setDeli] = useState(0);
  const [other, setOther] = useState(0);
  const [profitMode, setProfitMode] = useState<ProfitMode>("PERCENT");
  const [percentProfit, setPercentProfit] = useState(20);
  const [fixedProfit, setFixedProfit] = useState(0);
  const [rounding, setRounding] = useState<RoundingRule>("NEAREST_500");
  const [minMode, setMinMode] = useState<MinimumPriceMode>("base_sell_plus_extra");
  const [buffer, setBuffer] = useState(0);

  const result = useMemo(() => calculatePricing({
    thbPrice: thb, buyRate, sellGap, cargoMMK: cargo, deliMMK: deli, otherMMK: other,
    profitMode, fixedProfit, percentProfit, roundingRule: rounding,
    minimumPriceMode: minMode, minimumBuffer: buffer,
  }), [thb, buyRate, sellGap, cargo, deli, other, profitMode, fixedProfit, percentProfit, rounding, minMode, buffer]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" />Exchange Rates</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Source</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="THB">THB</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="CNY">CNY</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Buy Rate (KS / 1 {source})</Label><Input type="number" step="0.01" value={buyRate} onChange={e => setBuyRate(+e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Sell Gap (KS)</Label><Input type="number" step="0.01" value={sellGap} onChange={e => setSellGap(+e.target.value)} /></div>
            <div className="col-span-2 space-y-1.5"><Label>Note</Label><Input value={note} onChange={e => setNote(e.target.value)} /></div>
          </div>
          <Button onClick={addRate} className="w-full"><Plus className="mr-2 h-4 w-4" />Save Rate</Button>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr><th className="px-3 py-2">Date</th><th>Source</th><th>Buy</th><th>Sell Gap</th><th></th></tr>
              </thead>
              <tbody>
                {rates.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No rates yet</td></tr>}
                {rates.map(r => (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2">{r.date}</td>
                    <td><Badge variant="outline">{r.source}</Badge></td>
                    <td className="font-medium">{Number(r.buy_rate).toFixed(2)}</td>
                    <td>{Number(r.sell_gap).toFixed(2)}</td>
                    <td className="text-right pr-2"><Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Pricing Calculator</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2"><Label>{source} Price</Label><Input type="number" value={thb} onChange={e => setThb(+e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Cargo (KS)</Label><Input type="number" value={cargo} onChange={e => setCargo(+e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Delivery (KS)</Label><Input type="number" value={deli} onChange={e => setDeli(+e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Other (KS)</Label><Input type="number" value={other} onChange={e => setOther(+e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Buffer (KS)</Label><Input type="number" value={buffer} onChange={e => setBuffer(+e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Profit Mode</Label>
              <Select value={profitMode} onValueChange={v => setProfitMode(v as ProfitMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERCENT">Percent</SelectItem>
                  <SelectItem value="FIXED">Fixed</SelectItem>
                  <SelectItem value="BOTH">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Rounding</Label>
              <Select value={rounding} onValueChange={v => setRounding(v as RoundingRule)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NO_ROUND">No round</SelectItem>
                  <SelectItem value="NEAREST_100">Nearest 100</SelectItem>
                  <SelectItem value="NEAREST_500">Nearest 500</SelectItem>
                  <SelectItem value="NEAREST_1000">Nearest 1000</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>% Profit</Label><Input type="number" value={percentProfit} onChange={e => setPercentProfit(+e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Fixed Profit</Label><Input type="number" value={fixedProfit} onChange={e => setFixedProfit(+e.target.value)} /></div>
            <div className="col-span-2 space-y-1.5"><Label>Minimum Mode</Label>
              <Select value={minMode} onValueChange={v => setMinMode(v as MinimumPriceMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="base_sell_plus_extra">Base sell + extra</SelectItem>
                  <SelectItem value="buy_plus_extra_plus_buffer">Buy + extra + buffer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="rounded-lg border bg-muted/30 p-4 space-y-1.5 text-sm">
            <Row label="Applied Buy Rate" value={result.appliedBuyRate.toFixed(2)} />
            <Row label="Applied Sell Rate" value={result.appliedSellRate.toFixed(2)} />
            <Row label="MMK Buy Price" value={formatKS(result.mmkBuyPrice)} />
            <Row label="Base Sell" value={formatKS(result.baseSellPriceMMK)} />
            <Row label="Total Extra" value={formatKS(result.totalExtraCost)} />
            <Row label="Cost Before Profit" value={formatKS(result.costBeforeProfit)} />
            <Row label="Minimum Price" value={formatKS(result.minimumPriceMMK)} />
            <div className="border-t pt-2 mt-2">
              <Row label="Final Sell" value={formatKS(result.finalSellMMK)} bold />
              <Row label="Net Profit" value={formatKS(result.trueNetProfit)} />
              <Row label="Margin %" value={`${result.marginPercent.toFixed(1)}%`} />
            </div>
            {result.belowMinimum && <Badge variant="outline" className="bg-amber-500/10 text-amber-600">Below minimum — adjusted</Badge>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "text-base font-semibold" : ""}`}>
      <span className="text-muted-foreground">{label}</span><span>{value}</span>
    </div>
  );
}
