import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Trash2, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { formatKS } from "@/lib/format";
import { getCart, updateQty, removeFromCart, clearCart, cartTotal, type CartItem } from "@/lib/cart";
import { toast } from "sonner";
import { StorageImage } from "@/components/StorageImage";

export const Route = createFileRoute("/shop/cart")({ component: CartPage });

function CartPage() {
  const nav = useNavigate();
  const [items, setItems] = useState<CartItem[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setItems(getCart());
    const h = () => setItems(getCart());
    window.addEventListener("cart-updated", h);
    return () => window.removeEventListener("cart-updated", h);
  }, []);

  const total = cartTotal(items);

  const checkout = async () => {
    if (items.length === 0) return toast.error("Cart is empty");
    if (!name || !phone) return toast.error("Name & phone required");
    setSubmitting(true);
    const { data: order, error } = await supabase.from("orders").insert({
      customer_name: name,
      customer_phone: phone,
      delivery_note: address,
      subtotal: total,
      total,
      status: "pending",
      payment_status: "unpaid",
    }).select().single();
    if (error || !order) { setSubmitting(false); return toast.error(error?.message ?? "Failed"); }

    await supabase.from("order_items").insert(items.map(i => ({
      order_id: order.id,
      product_id: i.product_id,
      product_name: i.name,
      unit_price: i.price,
      quantity: i.qty,
      line_total: i.price * i.qty,
    })));

    clearCart();
    setSubmitting(false);
    toast.success(`Order #${order.order_no} placed!`);
    nav({ to: "/shop" });
  };

  return (
    <div className="mx-auto min-h-screen max-w-3xl bg-background px-4 py-4">
      <Button variant="ghost" size="sm" asChild><Link to="/shop"><ArrowLeft className="mr-2 h-4 w-4" />Continue shopping</Link></Button>
      <h1 className="mt-3 text-2xl font-bold">Your Cart</h1>

      <div className="mt-4 space-y-2">
        {items.length === 0 && <Card><CardContent className="p-8 text-center text-muted-foreground">Cart is empty</CardContent></Card>}
        {items.map(i => (
          <Card key={i.id}><CardContent className="flex items-center gap-3 p-3">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded bg-muted">
              <StorageImage src={i.image_url} alt="" className="h-full w-full object-cover" fallback={<div className="flex h-full w-full items-center justify-center text-xl text-muted-foreground/40">📦</div>} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{i.name}</p>
              <p className="text-xs text-muted-foreground">{formatKS(i.price)}</p>
            </div>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(i.id, i.qty - 1)}><Minus className="h-3 w-3" /></Button>
              <span className="w-6 text-center text-sm">{i.qty}</span>
              <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(i.id, i.qty + 1)}><Plus className="h-3 w-3" /></Button>
            </div>
            <p className="w-20 text-right text-sm font-semibold">{formatKS(i.price * i.qty)}</p>
            <Button size="icon" variant="ghost" onClick={() => removeFromCart(i.id)}><Trash2 className="h-4 w-4" /></Button>
          </CardContent></Card>
        ))}
      </div>

      {items.length > 0 && (
        <Card className="mt-4">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between text-lg font-bold">
              <span>Total</span><span className="text-primary">{formatKS(total)}</span>
            </div>
            <div className="space-y-2">
              <div className="space-y-1.5"><Label>Your name *</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Phone *</Label><Input value={phone} onChange={e => setPhone(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Delivery address</Label><Textarea value={address} onChange={e => setAddress(e.target.value)} /></div>
            </div>
            <Button size="lg" className="w-full" onClick={checkout} disabled={submitting}>{submitting ? "Placing…" : "Place order"}</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
