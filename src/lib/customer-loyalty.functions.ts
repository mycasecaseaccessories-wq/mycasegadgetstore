import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Get current user's loyalty balance by their phone number. */
export const getMyLoyalty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { phone?: string | null }) =>
    z.object({ phone: z.string().trim().min(1).max(64).nullable().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const phone = (data.phone ?? "").trim();
    if (!phone) return { points: 0, history: [] as any[] };
    const key = phone;

    const { data: bal } = await supabaseAdmin
      .from("loyalty_balances")
      .select("points, customer_phone, customer_key")
      .or(`customer_phone.eq.${phone},customer_key.eq.${key}`)
      .maybeSingle();

    const { data: history } = await supabaseAdmin
      .from("loyalty_transactions")
      .select("id, kind, delta, value, note, created_at, order_id")
      .eq("customer_key", key)
      .order("created_at", { ascending: false })
      .limit(20);

    return {
      userId: context.userId,
      points: Number((bal as any)?.points ?? 0),
      history: history ?? [],
    };
  });

/**
 * Redeem points for an order. Validates the order belongs to the calling user.
 * Returns the redeemed value (in currency units) to apply as discount.
 */
export const redeemMyPoints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string; phone: string; points: number; redeemValue: number; minRedeem: number }) =>
    z
      .object({
        orderId: z.string().uuid(),
        phone: z.string().trim().min(1).max(64),
        points: z.number().int().positive().max(1_000_000),
        redeemValue: z.number().positive().max(1000),
        minRedeem: z.number().int().nonnegative().max(100000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // Verify the order belongs to this user
    const { data: order, error: ordErr } = await supabaseAdmin
      .from("orders")
      .select("id, user_id, total")
      .eq("id", data.orderId)
      .maybeSingle();
    if (ordErr) throw new Error(ordErr.message);
    if (!order || (order as any).user_id !== context.userId) {
      throw new Error("Order not found");
    }

    const key = data.phone.trim();

    // Check balance
    const { data: bal } = await supabaseAdmin
      .from("loyalty_balances")
      .select("points")
      .eq("customer_key", key)
      .maybeSingle();
    const current = Number((bal as any)?.points ?? 0);

    if (data.points < data.minRedeem) throw new Error(`Minimum ${data.minRedeem} points required`);
    if (data.points > current) throw new Error("Not enough points");

    const value = data.points * data.redeemValue;
    const next = current - data.points;
    const newTotal = Math.max(0, Number((order as any).total ?? 0) - value);

    // Update balance
    await supabaseAdmin
      .from("loyalty_balances")
      .upsert(
        { customer_key: key, points: next, customer_phone: key, updated_at: new Date().toISOString() },
        { onConflict: "customer_key" },
      );

    // Log transaction
    await supabaseAdmin.from("loyalty_transactions").insert({
      customer_key: key,
      order_id: data.orderId,
      kind: "redeem",
      delta: -data.points,
      value,
      note: "Redeemed at checkout",
    });

    // Update order with redeemed points + discount
    await supabaseAdmin
      .from("orders")
      .update({ points_redeemed: data.points, discount: value, total: newTotal })
      .eq("id", data.orderId);

    return { value, newTotal, remainingPoints: next };
  });

/** Award points after an order is placed (server-side, trusted). */
export const awardMyPoints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string; phone: string; amount: number; earnPerAmount: number }) =>
    z
      .object({
        orderId: z.string().uuid(),
        phone: z.string().trim().min(1).max(64),
        amount: z.number().nonnegative(),
        earnPerAmount: z.number().positive().max(1_000_000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, user_id")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order || (order as any).user_id !== context.userId) throw new Error("Order not found");

    const pts = Math.floor(data.amount / data.earnPerAmount);
    if (pts <= 0) return { earned: 0 };

    const key = data.phone.trim();
    const { data: bal } = await supabaseAdmin
      .from("loyalty_balances")
      .select("points")
      .eq("customer_key", key)
      .maybeSingle();
    const next = Number((bal as any)?.points ?? 0) + pts;

    await supabaseAdmin
      .from("loyalty_balances")
      .upsert(
        { customer_key: key, points: next, customer_phone: key, updated_at: new Date().toISOString() },
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
