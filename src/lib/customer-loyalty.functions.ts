import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type LoyaltyCfg = {
  enabled: boolean;
  earnPerAmount: number;
  redeemValue: number;
  minRedeem: number;
};

async function loadLoyaltyConfig(): Promise<LoyaltyCfg> {
  const { data } = await supabaseAdmin
    .from("settings")
    .select("*")
    .limit(1)
    .maybeSingle();
  const r: any = data ?? {};
  return {
    enabled: r.loyalty_enabled ?? true,
    earnPerAmount: Number(r.loyalty_earn_per_amount ?? 1000),
    redeemValue: Number(r.loyalty_redeem_value ?? 1),
    minRedeem: Number(r.loyalty_min_redeem ?? 50),
  };
}

/** Get current user's loyalty balance + server-trusted config. */
export const getMyLoyalty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { phone?: string | null }) =>
    z.object({ phone: z.string().trim().min(1).max(64).nullable().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const cfg = await loadLoyaltyConfig();
    const phone = (data.phone ?? "").trim();
    if (!phone) return { points: 0, history: [] as any[], config: cfg };

    const { data: bal } = await supabaseAdmin
      .from("loyalty_balances")
      .select("points")
      .eq("customer_key", phone)
      .maybeSingle();

    const { data: history } = await supabaseAdmin
      .from("loyalty_transactions")
      .select("id, kind, delta, value, note, created_at, order_id")
      .eq("customer_key", phone)
      .order("created_at", { ascending: false })
      .limit(20);

    return {
      userId: context.userId,
      points: Number((bal as any)?.points ?? 0),
      history: history ?? [],
      config: cfg,
    };
  });

/** Award points after an order is placed. Server reads earnPerAmount from settings. */
export const awardMyPoints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string; phone: string }) =>
    z
      .object({
        orderId: z.string().uuid(),
        phone: z.string().trim().min(1).max(64),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const cfg = await loadLoyaltyConfig();
    if (!cfg.enabled || cfg.earnPerAmount <= 0) return { earned: 0 };

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, user_id, total")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order || (order as any).user_id !== context.userId) throw new Error("Order not found");

    const pts = Math.floor(Number((order as any).total ?? 0) / cfg.earnPerAmount);
    if (pts <= 0) return { earned: 0 };

    const key = data.phone.trim();
    const { data: bal } = await supabaseAdmin
      .from("loyalty_balances")
      .select("points")
      .eq("customer_key", key)
      .maybeSingle();
    const next = Number((bal as any)?.points ?? 0) + pts;

    await supabaseAdmin.from("loyalty_balances").upsert(
      {
        customer_key: key,
        points: next,
        customer_phone: key,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "customer_key" },
    );
    await supabaseAdmin.from("loyalty_transactions").insert({
      customer_key: key,
      order_id: data.orderId,
      kind: "earn",
      delta: pts,
      value: 0,
      note: "Earned from checkout",
    });
    await supabaseAdmin.from("orders").update({ points_earned: pts }).eq("id", data.orderId);
    return { earned: pts };
  });
