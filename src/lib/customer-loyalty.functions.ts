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
    // Never accept a client-selected loyalty key. Resolve it from this
    // authenticated user's own order history instead.
    const { data: ownOrder } = await supabaseAdmin
      .from("orders")
      .select("customer_phone")
      .eq("user_id", context.userId)
      .not("customer_phone", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const phone = String(ownOrder?.customer_phone ?? "").trim();
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

/** Award points from the persisted order total using an atomic, idempotent DB RPC. */
export const awardMyPoints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string }) =>
    z.object({ orderId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: earned, error } = await supabaseAdmin.rpc("award_order_loyalty_points", {
      p_order_id: data.orderId,
      p_user_id: context.userId,
    });
    if (error) throw new Error(error.message);
    return { earned: Number(earned ?? 0) };
  });
