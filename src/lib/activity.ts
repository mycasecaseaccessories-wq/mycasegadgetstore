// Phase 5 — Lightweight audit-log helper.
// Fail-silent: logging never blocks or breaks calling business logic.
import { supabase } from "@/integrations/supabase/client";

export type ActivityAction =
  | "create" | "update" | "delete"
  | "order.create" | "order.update" | "order.status"
  | "voucher.create" | "voucher.update" | "voucher.print"
  | "product.create" | "product.update" | "product.delete"
  | "po.receive" | "expense.create"
  | "auth.login" | "auth.logout"
  | "settings.update" | "role.change"
  | string;

export interface LogActivityInput {
  action: ActivityAction;
  entityType?: string;
  entityId?: string | number | null;
  summary?: string;
  metadata?: Record<string, unknown>;
}

export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    await supabase.from("activity_logs").insert({
      user_id: user.id,
      user_name: (user.user_metadata as any)?.full_name ?? user.email ?? null,
      action: input.action,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId != null ? String(input.entityId) : null,
      summary: input.summary ?? null,
      metadata: (input.metadata ?? {}) as any,
    });
  } catch {
    // never throw from audit logger
  }
}
