import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Search, Receipt, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatKS } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/vouchers")({ component: VouchersPage });

type Voucher = {
  id: string; voucher_no: number; customer_name: string | null; customer_phone: string | null;
  total: number; paid: number; payment_method: string | null; issued_at: string;
};

function VouchersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data: vouchers = [], refetch } = useQuery({
    queryKey: ["vouchers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vouchers").select("*").order("issued_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data as Voucher[];
    },
  });

  const filtered = vouchers.filter(v =>
    [v.voucher_no, v.customer_name, v.customer_phone].filter(Boolean).join(" ").toLowerCase().includes(search.toLowerCase())
  );

  const createBlank = async () => {
    const { data, error } = await supabase.from("vouchers").insert({ items: [] }).select("id").single();
    if (error) return toast.error(error.message);
    navigate({ to: "/vouchers/$id", params: { id: data.id } });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search vouchers…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={createBlank}><Plus className="mr-2 h-4 w-4" />New Voucher</Button>
      </div>

      <Card><CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-3">No.</th><th>Customer</th><th>Phone</th><th>Total</th><th>Paid</th><th>Method</th><th>Date</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No vouchers</td></tr>}
            {filtered.map(v => (
              <tr key={v.id} className="border-t">
                <td className="px-4 py-3 font-mono font-medium">#{v.voucher_no}</td>
                <td>{v.customer_name ?? "—"}</td>
                <td className="text-muted-foreground">{v.customer_phone ?? "—"}</td>
                <td className="font-medium">{formatKS(v.total)}</td>
                <td>{formatKS(v.paid)}</td>
                <td>{v.payment_method ? <Badge variant="outline">{v.payment_method}</Badge> : "—"}</td>
                <td className="text-muted-foreground text-xs">{new Date(v.issued_at).toLocaleDateString()}</td>
                <td className="text-right pr-2">
                  <Button asChild size="icon" variant="ghost"><Link to="/vouchers/$id" params={{ id: v.id }}><Eye className="h-4 w-4" /></Link></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent></Card>
    </div>
  );
}
