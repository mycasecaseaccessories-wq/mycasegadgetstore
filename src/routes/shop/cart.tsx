import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Trash2, Plus, Minus, Sparkles, LogIn, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatKS } from "@/lib/format";
import {
  getCart,
  updateQty,
  removeFromCart,
  clearCart,
  cartTotal,
  type CartItem,
} from "@/lib/cart";
import { toast } from "sonner";
import { StorageImage } from "@/components/StorageImage";
import { CartBadge } from "@/components/shop/CartBadge";
import { ShopAccountButton } from "@/components/shop/ShopAccountButton";
import { getConfig as getLoyaltyConfig } from "@/lib/loyalty";
import { getMyLoyalty, awardMyPoints } from "@/lib/customer-loyalty.functions";

export const Route = createFileRoute("/shop/cart")({ component: CartPage });

function CartPage() {
  const nav = useNavigate();
  const [items, setItems] = useState<CartItem[]>([]);
  const [user, setUser] = useState<any>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [points, setPoints] = useState(0);
  const [redeemPts, setRedeemPts] = useState(0);

  const fetchLoyalty = useServerFn(getMyLoyalty);
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
  const canRedeem = !!user && loyaltyCfg.enabled && points >= loyaltyCfg.minRedeem && points > 0;
  const maxRedeem = Math.min(points, Math.floor(subtotal / Math.max(loyaltyCfg.redeemValue, 1)));
  const hasPreorder = items.some((item) => item.fulfillment_type === "PREORDER");
  const depositTotal = items.reduce(
    (sum, item) => sum + Number(item.deposit_required ?? 0) * item.qty,
    0,
  );
  const { data: paymentMethods = [] } = useQuery({
    queryKey: ["active-payment-methods"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("payment_methods" as any) as any)
        .select("id, provider, account_name, account_number, bank_name, note, qr_url")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const checkout = async () => {
    if (items.length === 0) return toast.error("Cart is empty");
    if (!name || !phone) return toast.error("Name & phone required");
    if (hasPreorder && !paymentMethodId) {
      return toast.error("Select a payment method for the pre-order deposit");
    }
    setSubmitting(true);
    try {
      const { data: orderId, error } = await supabase.rpc("create_order_with_items", {
        p_customer_name: name,
        p_customer_phone: phone,
        p_delivery_note: address,
        p_discount: 0,
        p_extra_fee: 0,
        p_redeem_points: redeemPts,
          p_items: items.map((i) => ({
            product_id: i.product_id,
            variant_id: i.variant_id ?? null,
            product_name: i.name,
            unit_price: i.price,
            quantity: i.qty,
            line_total: i.price * i.qty,
            fulfillment_type: i.fulfillment_type ?? "IN_STOCK",
            estimated_arrival: i.estimated_arrival ?? null,
            deposit_required: i.deposit_required ?? 0,
          })),
      });
      if (error || !orderId) throw error ?? new Error("Failed");

      const { error: paymentError } = await supabase.rpc("finalize_order_payment_details", {
        p_order_id: orderId,
        p_payment_method_id: paymentMethodId || null,
      });
      if (paymentError) throw paymentError;

      // Award points after successful order creation. Redemption is committed atomically by the RPC.
      if (phone) {
        try {
          const { data: savedOrder } = await supabase
            .from("orders")
            .select("total")
            .eq("id", orderId)
            .maybeSingle();
          await awardFn({ data: { orderId, phone, amount: Number(savedOrder?.total ?? total) } });
        } catch {
          /* non-fatal */
        }
      }

      clearCart();
      toast.success("Order placed successfully!");
      nav({ to: user ? "/shop/account" : "/shop" });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f8f6] dark:bg-background">
      <header className="border-b border-[#dfe6e1] bg-[#f7f8f6]/95 px-4 py-4 backdrop-blur dark:bg-background/95">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <Link to="/shop" className="text-base font-black tracking-[0.22em]">
            MY CASE
          </Link>
          <div className="flex items-center gap-2">
            <ShopAccountButton />
            <CartBadge />
          </div>
        </div>
      </header>
      <main className="motion-page mx-auto max-w-5xl px-4 py-6 lg:py-10">
        <Button variant="ghost" size="sm" asChild className="mb-4 -ml-3">
          <Link to="/shop">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Continue shopping
          </Link>
        </Button>
        <div className="mb-6 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#247a62]">
              Ready when you are
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.03em]">Your cart</h1>
          </div>
          {items.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {items.reduce((sum, item) => sum + item.qty, 0)} items
            </span>
          )}
        </div>

        <div className="mt-4 space-y-2">
          {items.length === 0 && (
            <Card className="rounded-2xl border-dashed shadow-none">
              <CardContent className="flex flex-col items-center p-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#e4f2e9] text-[#247a62]">
                  <ShoppingBag className="h-6 w-6" />
                </div>
                <h2 className="mt-4 font-bold text-foreground">
                  Your cart is waiting for something good.
                </h2>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Browse the MY CASE collection and add your next everyday essential.
                </p>
                <Button
                  asChild
                  className="mt-5 rounded-full bg-[#18211f] text-white hover:bg-[#247a62]"
                >
                  <Link to="/shop">Explore products</Link>
                </Button>
              </CardContent>
            </Card>
          )}
          {items.map((i) => (
            <Card key={i.id} className="rounded-2xl border-[#dfe6e1] shadow-none">
              <CardContent className="flex items-center gap-3 p-3 sm:p-4">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted sm:h-24 sm:w-24">
                  <StorageImage
                    src={i.image_url}
                    alt=""
                    className="h-full w-full object-cover"
                    fallback={
                      <div className="flex h-full w-full items-center justify-center text-xl text-muted-foreground/40">
                        📦
                      </div>
                    }
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{i.name}</p>
                  <p className="text-xs text-muted-foreground">{formatKS(i.price)}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge
                      variant="outline"
                      className={
                        i.fulfillment_type === "PREORDER"
                          ? "border-amber-300 bg-amber-50 text-amber-800"
                          : "border-emerald-300 bg-emerald-50 text-emerald-800"
                      }
                    >
                      {i.fulfillment_type === "PREORDER" ? "PRE-ORDER" : "IN STOCK"}
                    </Badge>
                    {i.fulfillment_type === "PREORDER" && i.estimated_arrival && (
                      <span className="text-[11px] text-muted-foreground">
                        ETA: {i.estimated_arrival}
                      </span>
                    )}
                  </div>
                  {i.fulfillment_type === "PREORDER" && (i.deposit_required ?? 0) > 0 && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Deposit: {formatKS(i.deposit_required ?? 0)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    onClick={() => updateQty(i.id, i.qty - 1)}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-6 text-center text-sm">{i.qty}</span>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    onClick={() => updateQty(i.id, i.qty + 1)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <p className="w-24 text-right text-sm font-bold">{formatKS(i.price * i.qty)}</p>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Remove ${i.name}`}
                  onClick={() => removeFromCart(i.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {items.length > 0 && (
          <Card className="mt-6 rounded-2xl border-[#dfe6e1] shadow-none lg:ml-auto lg:max-w-md">
            <CardContent className="space-y-3 p-4">
              {!user && (
                <div className="rounded-lg border border-dashed p-3 text-sm">
                  <p className="mb-2 text-muted-foreground">
                    <ShoppingBag className="mr-1 inline h-4 w-4" />
                    You can checkout as a guest. Sign in is optional for order history and loyalty points.
                  </p>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/shop/login">
                      <LogIn className="mr-1 h-4 w-4" />
                      Sign in for loyalty points
                    </Link>
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
                      <Button size="sm" variant="ghost" onClick={() => setRedeemPts(0)}>
                        Clear
                      </Button>
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
                    <Button size="sm" variant="outline" onClick={() => setRedeemPts(maxRedeem)}>
                      Max
                    </Button>
                  </div>
                  {redeemPts > 0 && redeemPts < loyaltyCfg.minRedeem && (
                    <p className="text-xs text-destructive">
                      Minimum {loyaltyCfg.minRedeem} points
                    </p>
                  )}
                  {redeemPts >= loyaltyCfg.minRedeem && (
                    <p className="text-xs text-muted-foreground">
                      Discount:{" "}
                      <span className="font-semibold text-primary">{formatKS(discount)}</span>
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-1 border-t pt-3 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatKS(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-orange-600">
                    <span>Points discount</span>
                    <span>−{formatKS(discount)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t pt-2 text-lg font-bold">
                  <span>Total</span>
                  <span className="text-primary">{formatKS(total)}</span>
                </div>
                {hasPreorder && depositTotal > 0 && (
                  <div className="flex justify-between text-amber-700">
                    <span>Pre-order deposit due</span>
                    <span>{formatKS(depositTotal)}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="space-y-1.5">
                  <Label>Your name *</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone *</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Delivery address</Label>
                  <Textarea value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>
                {hasPreorder && (
                  <div className="space-y-1.5">
                    <Label>Deposit payment method *</Label>
                    <select
                      value={paymentMethodId}
                      onChange={(e) => setPaymentMethodId(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Select payment method</option>
                      {paymentMethods.map((method: any) => (
                        <option key={method.id} value={method.id}>
                          {method.provider} · {method.account_name} · {method.account_number}
                        </option>
                      ))}
                    </select>
                    {paymentMethods.length === 0 && (
                      <p className="text-xs text-destructive">
                        No active payment method is configured. Please contact the store.
                      </p>
                    )}
                  </div>
                )}
              </div>
              <Button size="lg" className="w-full" onClick={checkout} disabled={submitting}>
                {submitting ? "Placing…" : "Place order"}
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
