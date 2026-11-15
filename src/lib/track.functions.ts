import { createHash, timingSafeEqual } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Secure guest order lookup. The capability is a bearer secret returned only
 * by guest checkout; phone numbers and sequential order numbers are not proof
 * of ownership.
 */
export const trackGuestOrder = createServerFn({ method: "POST" })
  .inputValidator((input: { orderId: string; capability: string }) =>
    z
      .object({
        orderId: z.string().uuid(),
        capability: z.string().min(32).max(256),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, order_no, status, payment_status, total, created_at, user_id, guest_payment_capability_digest")
      .eq("id", data.orderId)
      .maybeSingle();

    if (orderError) throw new Error("Unable to look up this order");
    if (!order || order.user_id !== null || !order.guest_payment_capability_digest) {
      throw new Error("Order not found or tracking code is invalid");
    }

    const suppliedDigest = createHash("sha256").update(data.capability, "utf8").digest();
    const storedDigest = Buffer.from(order.guest_payment_capability_digest, "hex");
    if (
      storedDigest.length !== suppliedDigest.length ||
      !timingSafeEqual(storedDigest, suppliedDigest)
    ) {
      throw new Error("Order not found or tracking code is invalid");
    }

    const { data: items, error: itemsError } = await supabaseAdmin
      .from("order_items")
      .select("id, product_name, quantity, line_total, fulfillment_type, estimated_arrival, deposit_required")
      .eq("order_id", order.id);

    if (itemsError) throw new Error("Unable to load order items");

    return {
      order: {
        id: order.id,
        order_no: order.order_no,
        status: order.status,
        payment_status: order.payment_status,
        total: order.total,
        created_at: order.created_at,
        items: items ?? [],
      },
    };
  });
