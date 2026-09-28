import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Search, ShoppingBag, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime, formatKS } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/sales")({ component: SalesPage });

type Customer = { id: string; name: string; phone: string | null; phone_2: string | null; address: string | null; city: string | null; region: string | null };
type Product = { id: string; name: string; price: number; final_sell_mmk: number | null };
type Variant = { id: string; name: string; size: string | null; color: string | null; price: number; final_sell_mmk: number | null; status: string };
type Sale = { id: string; order_no: number; customer_name: string | null; customer_phone: string | null; total: number; deposit_amount: number; balance_amount: number; delivery_status: string; payment_status: string; created_at: string; tracking_number: string | null };

const deliveryStatuses = ["PENDING", "PREPARING", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELLED", "RETURNED"];

function SalesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState("");
  const [deposit, setDeposit] = useState("0");
  const [deliveryStatus, setDeliveryStatus] = useState("PENDING");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: customers = [] } = useQuery({
    queryKey: ["sales-customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id, name, phone, phone_2, address, city, region").order("name");
      if (error) throw error;
      return data as Customer[];
    },
  });
  const { data: products = [] } = useQuery({
    queryKey: ["sales-products"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("products" as any) as any).select("id, name, price, final_sell_mmk").eq("status", "ACTIVE").order("name");
      if (error) throw error;
      return data as Product[];
    },
  });
  const { data: variants = [] } = useQuery({
    queryKey: ["sales-variants", productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("product_variants" as any) as any).select("id, name, size, color, price, final_sell_mmk, status").eq("product_id", productId).eq("status", "ACTIVE").order("name");
      if (error) throw error;
      return data as Variant[];
    },
  });
  const { data: sales = [] } = useQuery({
    queryKey: ["manual-sales"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("orders" as any) as any).select("id, order_no, customer_name, customer_phone, total, deposit_amount, balance_amount, delivery_status, payment_status, created_at, tracking_number").eq("order_source", "MANUAL").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data as Sale[];
    },
  });

  const selectedCustomer = customers.find((customer) => customer.id === customerId);
  const selectedProduct = products.find((product) => product.id === productId);
  const selectedVariant = variants.find((variant) => variant.id === variantId);
  const defaultPrice = Number(selectedVariant?.final_sell_mmk ?? selectedVariant?.price ?? selectedProduct?.final_sell_mmk ?? selectedProduct?.price ?? 0);
  const total = Math.max(0, Number(price || defaultPrice) || 0) * Math.max(1, Number(quantity) || 1);
  const depositValue = Math.min(total, Math.max(0, Number(deposit) || 0));
  const balance = Math.max(0, total - depositValue);
  const filteredSales = useMemo(() => sales.filter((sale) => !search || [sale.customer_name, sale.customer_phone, sale.tracking_number, String(sale.order_no)].filter(Boolean).join(" ").toLowerCase().includes(search.toLowerCase())), [sales, search]);

  const reset = () => { setCustomerId(""); setProductId(""); setVariantId(""); setQuantity("1"); setPrice(""); setDeposit("0"); setDeliveryStatus("PENDING"); setTrackingNumber(""); setNote(""); };

  const updateDeliveryStatus = async (sale: Sale, nextStatus: string) => {
    const orderStatus = nextStatus === "CANCELLED" ? "cancelled" : nextStatus === "COMPLETED" ? "completed" : nextStatus === "DELIVERED" ? "processing" : "pending";
    const { error } = await (supabase.from("orders" as any) as any).update({ delivery_status: nextStatus, status: orderStatus }).eq("id", sale.id);
    if (error) return toast.error(error.message);
    toast.success("Delivery status updated");
    qc.invalidateQueries({ queryKey: ["manual-sales"] });
  };

  const saveSale = async () => {
    if (!selectedCustomer) return toast.error("Select a customer first");
    if (!selectedProduct) return toast.error("Select a product first");
    if (total <= 0) return toast.error("Enter a valid sale price");
    setSaving(true);
    try {
      const paymentStatus = depositValue >= total ? "paid" : depositValue > 0 ? "partial" : "unpaid";
      const orderStatus = deliveryStatus === "CANCELLED" ? "cancelled" : deliveryStatus === "COMPLETED" ? "completed" : "pending";
      const address = [selectedCustomer.address, selectedCustomer.city, selectedCustomer.region].filter(Boolean).join(", ");
      const { data: order, error: orderError } = await (supabase.from("orders" as any) as any).insert({
        customer_id: selectedCustomer.id,
        customer_name: selectedCustomer.name,
        customer_phone: selectedCustomer.phone,
        delivery_note: [address, note].filter(Boolean).join("\n"),
        subtotal: total,
        discount: 0,
        extra_fee: 0,
        total,
        order_source: "MANUAL",
        deposit_amount: depositValue,
        balance_amount: balance,
        payment_status: paymentStatus,
        status: orderStatus,
        delivery_status: deliveryStatus,
        tracking_number: trackingNumber.trim() || null,
      }).select("id").single();
      if (orderError || !order) throw orderError ?? new Error("Could not create sale");
      const { error: itemError } = await (supabase.from("order_items" as any) as any).insert({
        order_id: order.id,
        product_id: selectedProduct.id,
        variant_id: selectedVariant?.id ?? null,
        product_name: [selectedProduct.name, selectedVariant?.color, selectedVariant?.size].filter(Boolean).join(" · "),
        unit_price: total / Math.max(1, Number(quantity) || 1),
        quantity: Math.max(1, Number(quantity) || 1),
        line_total: total,
      });
      if (itemError) throw itemError;
      toast.success("Manual sale saved");
      reset();
      qc.invalidateQueries({ queryKey: ["manual-sales"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
    } catch (error: any) { toast.error(error?.message ?? "Could not save sale"); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Admin records</p><h2 className="mt-1 text-2xl font-bold">Manual Sales</h2><p className="text-sm text-muted-foreground">Messenger, phone, and in-person sales — separate from website orders.</p></div><Button variant="outline" asChild><Link to="/customers"><Plus className="mr-2 h-4 w-4" />Manage customers</Link></Button></div>
      <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShoppingBag className="h-4 w-4 text-primary" />New manual sale</CardTitle></CardHeader><CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2"><div className="space-y-1.5"><Label>Customer</Label><Select value={customerId} onValueChange={setCustomerId}><SelectTrigger><SelectValue placeholder="Choose saved customer…" /></SelectTrigger><SelectContent>{customers.map((customer) => <SelectItem key={customer.id} value={customer.id}>{customer.name}{customer.phone ? ` · ${customer.phone}` : ""}</SelectItem>)}</SelectContent></Select>{selectedCustomer && <p className="text-xs text-muted-foreground">{[selectedCustomer.address, selectedCustomer.city, selectedCustomer.region].filter(Boolean).join(", ") || "No address saved"}</p>}</div><div className="space-y-1.5"><Label>Product</Label><Select value={productId} onValueChange={(value) => { setProductId(value); setVariantId(""); setPrice(""); }}><SelectTrigger><SelectValue placeholder="Choose product…" /></SelectTrigger><SelectContent>{products.map((product) => <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>)}</SelectContent></Select></div></div>
        {variants.length > 0 && <div className="space-y-1.5"><Label>Variant (optional)</Label><Select value={variantId} onValueChange={(value) => { setVariantId(value); setPrice(""); }}><SelectTrigger><SelectValue placeholder="Choose color / model…" /></SelectTrigger><SelectContent>{variants.map((variant) => <SelectItem key={variant.id} value={variant.id}>{[variant.color, variant.size, variant.name].filter(Boolean).join(" · ")}</SelectItem>)}</SelectContent></Select></div>}
        <div className="grid gap-3 sm:grid-cols-4"><div className="space-y-1.5"><Label>Quantity</Label><Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></div><div className="space-y-1.5"><Label>Sale price / item</Label><Input type="number" min="0" value={price} placeholder={String(defaultPrice || 0)} onChange={(e) => setPrice(e.target.value)} /></div><div className="space-y-1.5"><Label>Deposit</Label><Input type="number" min="0" value={deposit} onChange={(e) => setDeposit(e.target.value)} /></div><div className="rounded-lg bg-muted/50 px-3 py-2"><p className="text-xs text-muted-foreground">Balance</p><p className="font-semibold text-primary">{formatKS(balance)}</p></div></div>
        <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label>Delivery status</Label><Select value={deliveryStatus} onValueChange={setDeliveryStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{deliveryStatuses.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><Label>Tracking number (optional)</Label><Input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="LEX..." /></div></div>
        <div className="space-y-1.5"><Label>Delivery address / note</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Extra delivery instructions" /></div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-primary/[0.04] p-3"><div><p className="text-xs text-muted-foreground">Total sale</p><p className="text-xl font-bold text-primary">{formatKS(total)}</p><p className="text-xs text-muted-foreground">{depositValue > 0 ? `${formatKS(depositValue)} deposit · ${formatKS(balance)} balance` : "No deposit yet"}</p></div><Button onClick={saveSale} disabled={saving}>{saving ? "Saving…" : "Save manual sale"}</Button></div>
      </CardContent></Card>
      <Card><CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle className="text-base">Manual sales history</CardTitle><div className="relative w-full max-w-xs"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search customer, order, tracking…" value={search} onChange={(e) => setSearch(e.target.value)} /></div></CardHeader><CardContent className="overflow-x-auto p-0"><table className="w-full text-sm"><thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Order</th><th>Customer</th><th>Total</th><th>Deposit / Balance</th><th>Payment</th><th>Delivery</th><th>Tracking</th><th>Date</th></tr></thead><tbody>{filteredSales.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No manual sales yet</td></tr>}{filteredSales.map((sale) => <tr key={sale.id} className="border-t"><td className="px-4 py-3 font-medium">#{sale.order_no}</td><td>{sale.customer_name}<p className="text-xs text-muted-foreground">{sale.customer_phone || "—"}</p></td><td className="font-medium">{formatKS(sale.total)}</td><td><span className="text-emerald-600">{formatKS(sale.deposit_amount)}</span><span className="text-muted-foreground"> / {formatKS(sale.balance_amount)}</span></td><td><Badge variant="outline">{sale.payment_status}</Badge></td><td><Select value={sale.delivery_status} onValueChange={(value) => updateDeliveryStatus(sale, value)}><SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger><SelectContent>{deliveryStatuses.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></td><td className="text-xs text-muted-foreground">{sale.tracking_number || "—"}</td><td className="pr-4 text-xs text-muted-foreground">{formatDateTime(sale.created_at)}</td></tr>)}</tbody></table></CardContent></Card>
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><WalletCards className="h-4 w-4" />Website orders remain separate under Orders; this page is for Admin-entered sales.</div>
    </div>
  );
}
