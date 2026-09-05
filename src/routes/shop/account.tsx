import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, LogOut, Package, Sparkles, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatKS, formatDateTime } from "@/lib/format";
import { CartBadge } from "@/components/shop/CartBadge";
import { getMyLoyalty } from "@/lib/customer-loyalty.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/shop/account")({ component: AccountPage });

function AccountPage() {
  const nav = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user;
      setUser(u ?? null);
      if (u) {
        setName((u.user_metadata as any)?.full_name ?? "");
        setPhone((u.user_metadata as any)?.phone ?? "");
      }
      setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      setUser(u ?? null);
      if (u) {
        setName((u.user_metadata as any)?.full_name ?? "");
        setPhone((u.user_metadata as any)?.phone ?? "");
      }
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (ready && !user) nav({ to: "/shop/login" });
  }, [ready, user, nav]);

  const { data: orders = [] } = useQuery({
    queryKey: ["my-orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select(
          "id, order_no, total, status, payment_status, order_date, points_earned, points_redeemed",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const fetchLoyalty = useServerFn(getMyLoyalty);
  const { data: loyalty } = useQuery({
    queryKey: ["my-loyalty", user?.id, phone],
    enabled: !!user && !!phone,
    queryFn: () => fetchLoyalty({ data: { phone } }),
  });

  const savePhone = async () => {
    const { error } = await supabase.auth.updateUser({ data: { full_name: name, phone } });
    if (error) return toast.error(error.message);
    toast.success("Saved");
  };

  const logout = async () => {
    await supabase.auth.signOut();
    nav({ to: "/shop" });
  };

  if (!ready || !user) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/shop">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Shop
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <CartBadge />
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="mr-1 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-5">
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-br from-primary/15 to-accent/10 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <User className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold">{name || user.email}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-lg bg-background/70 p-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Loyalty points</p>
                  <p className="text-2xl font-bold">{loyalty?.points ?? 0}</p>
                </div>
              </div>
              {!phone && <Badge variant="outline">Add phone to earn points</Badge>}
            </div>
          </div>
          <CardContent className="space-y-3 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone (for loyalty)</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="09xxxxxxxx"
                />
              </div>
            </div>
            <Button onClick={savePhone} className="w-full sm:w-auto">
              Save profile
            </Button>
          </CardContent>
        </Card>

        <div>
          <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold">
            <Package className="h-5 w-5" />
            Order history
          </h2>
          {orders.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No orders yet
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {orders.map((o: any) => (
                <Card key={o.id}>
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <div>
                      <p className="font-semibold">Order #{o.order_no}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(o.order_date)}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <Badge variant="outline">{o.status}</Badge>
                        <Badge variant="outline">{o.payment_status}</Badge>
                        {o.points_earned > 0 && (
                          <Badge variant="outline" className="bg-primary/10 text-primary">
                            +{o.points_earned} pts
                          </Badge>
                        )}
                        {o.points_redeemed > 0 && (
                          <Badge variant="outline" className="bg-orange-500/10 text-orange-600">
                            -{o.points_redeemed} pts
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-right text-lg font-bold text-primary">{formatKS(o.total)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {loyalty && loyalty.history && loyalty.history.length > 0 && (
          <div>
            <h2 className="mb-2 text-lg font-semibold">Points activity</h2>
            <Card>
              <CardContent className="divide-y p-0">
                {loyalty.history.map((h: any) => (
                  <div key={h.id} className="flex items-center justify-between p-3">
                    <div>
                      <p className="text-sm font-medium capitalize">{h.kind}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(h.created_at)} · {h.note}
                      </p>
                    </div>
                    <p
                      className={`font-semibold ${h.delta > 0 ? "text-green-600" : "text-orange-600"}`}
                    >
                      {h.delta > 0 ? "+" : ""}
                      {h.delta} pts
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
