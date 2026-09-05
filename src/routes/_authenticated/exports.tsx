import { createFileRoute } from "@tanstack/react-router";
import { RequireAdmin } from "@/components/RequireAdmin";
import { useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/exports")({
  component: () => (
    <RequireAdmin>
      <ExportsPage />
    </RequireAdmin>
  ),
});

function toCsv(rows: (string | number | null | undefined)[][]) {
  return rows
    .map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

function download(name: string, csv: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function ExportsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (kind: string, fn: () => Promise<void>) => {
    setBusy(kind);
    try {
      await fn();
      toast.success(`${kind} exported`);
    } catch (e: any) {
      toast.error(e.message ?? "Export failed");
    } finally {
      setBusy(null);
    }
  };

  const exportProducts = () =>
    run("Products", async () => {
      const { data, error } = await supabase.from("products").select("*").order("name");
      if (error) throw error;
      const rows: (string | number | null)[][] = [
        [
          "Code",
          "Name",
          "Brand",
          "Category",
          "Size",
          "Price (KS)",
          "THB",
          "Stock In",
          "Sold",
          "Status",
          "Note",
        ],
      ];
      for (const p of data ?? [])
        rows.push([
          p.product_code,
          p.name,
          p.brand,
          p.category,
          p.size,
          p.price,
          p.thb_price,
          p.stock_in,
          p.sold_qty,
          p.status,
          p.note,
        ]);
      download(`products-${today}.csv`, toCsv(rows));
    });

  const exportCustomers = () =>
    run("Customers", async () => {
      const { data, error } = await supabase.from("customers").select("*").order("name");
      if (error) throw error;
      const rows: (string | number | null)[][] = [["Name", "Phone", "Address", "Note", "Created"]];
      for (const c of data ?? []) rows.push([c.name, c.phone, c.address, c.note, c.created_at]);
      download(`customers-${today}.csv`, toCsv(rows));
    });

  const exportOrders = () =>
    run("Orders", async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .gte("created_at", from + "T00:00:00")
        .lte("created_at", to + "T23:59:59")
        .order("order_no", { ascending: false });
      if (error) throw error;
      const rows: (string | number | null)[][] = [
        [
          "Order No",
          "Customer",
          "Phone",
          "Status",
          "Payment",
          "Subtotal",
          "Discount",
          "Extra Fee",
          "Total",
          "Date",
          "Note",
        ],
      ];
      for (const o of data ?? [])
        rows.push([
          o.order_no,
          o.customer_name,
          o.customer_phone,
          o.status,
          o.payment_status,
          o.subtotal,
          o.discount,
          o.extra_fee,
          o.total,
          o.created_at,
          o.delivery_note,
        ]);
      download(`orders-${from}-to-${to}.csv`, toCsv(rows));
    });

  const exportOrderItems = () =>
    run("Order Items", async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("*, orders!inner(order_no, created_at, customer_name)")
        .gte("created_at", from + "T00:00:00")
        .lte("created_at", to + "T23:59:59");
      if (error) throw error;
      const rows: (string | number | null)[][] = [
        ["Order No", "Customer", "Product", "Qty", "Unit Price", "Line Total", "Date"],
      ];
      for (const it of (data as any[]) ?? [])
        rows.push([
          it.orders?.order_no,
          it.orders?.customer_name,
          it.product_name,
          it.quantity,
          it.unit_price,
          it.line_total,
          it.created_at,
        ]);
      download(`order-items-${from}-to-${to}.csv`, toCsv(rows));
    });

  const exportVouchers = () =>
    run("Vouchers", async () => {
      const { data, error } = await supabase
        .from("vouchers")
        .select("*")
        .gte("issued_at", from + "T00:00:00")
        .lte("issued_at", to + "T23:59:59")
        .order("voucher_no", { ascending: false });
      if (error) throw error;
      const rows: (string | number | null)[][] = [
        [
          "Voucher No",
          "Customer",
          "Phone",
          "Subtotal",
          "Discount",
          "Extra",
          "Total",
          "Paid",
          "Method",
          "Issued",
        ],
      ];
      for (const v of data ?? [])
        rows.push([
          v.voucher_no,
          v.customer_name,
          v.customer_phone,
          v.subtotal,
          v.discount,
          v.extra_fee,
          v.total,
          v.paid,
          v.payment_method,
          v.issued_at,
        ]);
      download(`vouchers-${from}-to-${to}.csv`, toCsv(rows));
    });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Date range (orders, items, vouchers)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <ExportCard
          title="Products"
          desc="All products with stock & pricing"
          icon={<FileSpreadsheet className="h-5 w-5" />}
          disabled={busy !== null}
          loading={busy === "Products"}
          onClick={exportProducts}
        />
        <ExportCard
          title="Customers"
          desc="Customer contacts and addresses"
          icon={<FileSpreadsheet className="h-5 w-5" />}
          disabled={busy !== null}
          loading={busy === "Customers"}
          onClick={exportCustomers}
        />
        <ExportCard
          title="Orders"
          desc="Orders within date range"
          icon={<FileSpreadsheet className="h-5 w-5" />}
          disabled={busy !== null}
          loading={busy === "Orders"}
          onClick={exportOrders}
        />
        <ExportCard
          title="Order Items"
          desc="Line items for orders in range"
          icon={<FileSpreadsheet className="h-5 w-5" />}
          disabled={busy !== null}
          loading={busy === "Order Items"}
          onClick={exportOrderItems}
        />
        <ExportCard
          title="Vouchers"
          desc="Issued vouchers in range"
          icon={<FileSpreadsheet className="h-5 w-5" />}
          disabled={busy !== null}
          loading={busy === "Vouchers"}
          onClick={exportVouchers}
        />
      </div>
    </div>
  );
}

function ExportCard({
  title,
  desc,
  icon,
  onClick,
  disabled,
  loading,
}: {
  title: string;
  desc: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">{icon}</div>
          <div className="flex-1">
            <h3 className="font-semibold">{title}</h3>
            <p className="text-xs text-muted-foreground">{desc}</p>
          </div>
        </div>
        <Button onClick={onClick} disabled={disabled} className="mt-3 w-full" variant="outline">
          <Download className="mr-2 h-4 w-4" />
          {loading ? "Exporting..." : "Export CSV"}
        </Button>
      </CardContent>
    </Card>
  );
}
