import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Trash2, Plus, Minus, Sparkles, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatKS } from "@/lib/format";
import { getCart, updateQty, removeFromCart, clearCart, cartTotal, type CartItem } from "@/lib/cart";
import { toast } from "sonner";
import { StorageImage } from "@/components/StorageImage";
import { getConfig as getLoyaltyConfig } from "@/lib/loyalty";
import { getMyLoyalty, redeemMyPoints, awardMyPoints } from "@/lib/customer-loyalty.functions";

export const Route = createFileRoute("/shop/cart")({ component: CartPage });

function CartPage() {
  const nav = useNavigate();
  const [items, setItems] = useState<CartItem[]>([]);
  const [user, setUser] = useState<any>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [points, setPoints] = useState(0);
  const [redeemPts, setRedeemPts] = useState(0);

  const fetchLoyalty = useServerFn(getMyLoyalty);
  const redeemFn = useServerFn(redeemMyPoints);
  const awardFn = useServerFn(awardMyPoints);

  const loyaltyCfg = getLoyaltyConfig();

  useEffect(() => {
    setItems(getCart());
    const h = () => setItems(getCart());
    window.addEventListener("cart-updated", h);
    return () => window.removeEventListener("cart-updated", h);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      setUser(u ?? null);
      if (u) {
        const meta: any = u.user_metadata ?? {};
        setName(meta.full_name ?? "");
        setPhone(meta.phone ?? "");
      }
    });
  }, []);

  useEffect(() => {
    if (user && phone) {
      fetchLoyalty({ data: { phone } }).then((r) => setPoints(r.points));
    }
  }, [user, phone, fetchLoyalty]);

  const subtotal = cartTotal(items);
  const discount = redeemPts >= loyaltyCfg.minRedeem ? redeemPts * loyaltyCfg.redeemValue : 0;
  const total = Math.max(0, subtotal - discount);
  const canRedeem =
    !!user && loyaltyCfg.enabled && points >= loyaltyCfg.minRedeem && points > 0;
  const maxRedeem = Math.min(points, Math.floor(subtotal / Math.max(loyaltyCfg.redeemValue, 1)));

  const checkout = async () => {
    if (items.length === 0) return toast.error("Cart is empty");
    if (!user) {
      toast.error("Please sign in to place an order");
      nav({ to: "/shop/login" });
      return;
    }
    if (!name || !phone) return toast.error("Name & phone required");
    setSubmitting(true);
    try {
      const orderPayload: any = {
        customer_name: name,
        customer_phone: phone,
        delivery_note: address,
        subtotal,
        total: subtotal,
        discount: 0,
        status: "pending",
        payment_status: "unpaid",
        user_id: user.id,
      };

      const { data: order, error } = await supabase.from("orders").insert(orderPayload).select().single();
      if (error || !order) throw error ?? new Error("Failed");

      const { error: itemsErr } = await supabase.from("order_items").insert(
        items.map((i) => ({
          order_id: order.id,
          product_id: i.product_id,
          product_name: i.name,
          unit_price: i.price,
          quantity: i.qty,
          line_total: i.price * i.qty,
        })),
      );
      if (itemsErr) throw itemsErr;

      // Loyalty: redeem (if requested) + award. Server reads config from settings.
      if (phone) {
        if (redeemPts > 0) {
          try {
            await redeemFn({ data: { orderId: order.id, phone, points: redeemPts } });
          } catch (e: any) {
            toast.error(`Redeem skipped: ${e?.message ?? "failed"}`);
          }
        }
        try {
          await awardFn({ data: { orderId: order.id, phone, amount: total } });
        } catch { /* non-fatal */ }
      }

      clearCart();
      toast.success(`Order #${order.order_no} placed!`);
      nav({ to: "/shop/account" });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto min-h-screen max-w-3xl bg-background px-4 py-4">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/shop"><ArrowLeft className="mr-2 h-4 w-4" />Continue shopping</Link>
      </Button>
      <h1 className="mt-3 text-2xl font-bold">Your Cart</h1>

      <div className="mt-4 space-y-2">
        {items.length === 0 && (
          <Card><CardContent className="p-8 text-center text-muted-foreground">Cart is empty</CardContent></Card>
        )}
        {items.map((i) => (
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
            {!user && (
              <div className="rounded-lg border border-dashed p-3 text-sm">
                <p className="mb-2 text-muted-foreground">
                  <LogIn className="mr-1 inline h-4 w-4" />
                  Sign in to track this order, view history, and earn loyalty points.
                </p>
                <Button asChild size="sm" variant="outline">
                  <Link to="/shop/login">Sign in / Sign up</Link>
                </Button>
              </div>
            )}

            {user && canRedeem && (
              <div className="space-y-2 rounded-lg border bg-primary/5 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="font-medium">Redeem points</span>
                    <Badge variant="outline">{points} available</Badge>
                  </div>
                  {redeemPts > 0 && (
                    <Button size="sm" variant="ghost" onClick={() => setRedeemPts(0)}>Clear</Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={maxRedeem}
                    value={redeemPts || ""}
                    onChange={(e) => {
                      const v = Math.max(0, Math.min(maxRedeem, Number(e.target.value) || 0));
                      setRedeemPts(v);
                    }}
                    placeholder={`Min ${loyaltyCfg.minRedeem}`}
                    className="h-9"
                  />
                  <Button size="sm" variant="outline" onClick={() => setRedeemPts(maxRedeem)}>Max</Button>
                </div>
                {redeemPts > 0 && redeemPts < loyaltyCfg.minRedeem && (
                  <p className="text-xs text-destructive">Minimum {loyaltyCfg.minRedeem} points</p>
                )}
                {redeemPts >= loyaltyCfg.minRedeem && (
                  <p className="text-xs text-muted-foreground">
                    Discount: <span className="font-semibold text-primary">{formatKS(discount)}</span>
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1 border-t pt-3 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>{formatKS(subtotal)}</span></div>
              {discount > 0 && (
                <div className="flex justify-between text-orange-600"><span>Points discount</span><span>−{formatKS(discount)}</span></div>
              )}
              <div className="flex items-center justify-between border-t pt-2 text-lg font-bold">
                <span>Total</span><span className="text-primary">{formatKS(total)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="space-y-1.5"><Label>Your name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Phone *</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Delivery address</Label><Textarea value={address} onChange={(e) => setAddress(e.target.value)} /></div>
            </div>
            <Button size="lg" className="w-full" onClick={checkout} disabled={submitting}>
              {submitting ? "Placing…" : "Place order"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
