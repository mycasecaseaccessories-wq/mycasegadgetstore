import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Public order lookup by phone (+ optional order_no). No auth required. */
export const trackOrders = createServerFn({ method: "POST" })
  .inputValidator((input: { phone: string; orderNo?: string | null }) =>
    z.object({
      phone: z.string().trim().min(4).max(64),
      orderNo: z.string().trim().max(20).nullable().optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    let q = supabaseAdmin
      .from("orders")
      .select("id, order_no, status, payment_status, total, customer_name, customer_phone, delivery_note, created_at, items:order_items(id, product_name, quantity, line_total)")
      .eq("customer_phone", data.phone);
    if (data.orderNo) q = q.eq("order_no", Number(data.orderNo));
    const { data: rows, error } = await q.order("created_at", { ascending: false }).limit(20);
    if (error) throw new Error(error.message);
    return { orders: rows ?? [] };
  });
