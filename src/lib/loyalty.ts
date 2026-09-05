// Phase 19/20 — Customer loyalty (config in localStorage, balances in Supabase).
import { supabase } from "@/integrations/supabase/client";

const CFG_KEY = "mycase.loyalty.config.v1";

export interface LoyaltyConfig {
  enabled: boolean;
  earnPerAmount: number; // amount in active currency that earns 1 point
  redeemValue: number; // 1 point = X currency units when redeemed
  minRedeem: number; // minimum points required to redeem
}

const DEFAULT_CONFIG: LoyaltyConfig = {
  enabled: true,
  earnPerAmount: 1000,
  redeemValue: 1,
  minRedeem: 50,
};

type Listener = () => void;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l());
export function onLoyaltyChange(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getConfig(): LoyaltyConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(CFG_KEY);
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function setConfig(cfg: LoyaltyConfig) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
  emit();
}

/** Build a stable key from a customer (phone preferred, falls back to id). */
export function customerKey(c: { id?: string | null; phone?: string | null }): string {
  return (c.phone || c.id || "").toString().trim();
}

/** Compute points earned from a purchase amount based on config. */
export function pointsFor(amount: number): number {
  const cfg = getConfig();
  if (!cfg.enabled || cfg.earnPerAmount <= 0) return 0;
  return Math.floor(amount / cfg.earnPerAmount);
}

export async function getBalance(key: string): Promise<number> {
  if (!key) return 0;
  const { data } = await supabase
    .from("loyalty_balances" as any)
    .select("points")
    .eq("customer_key", key)
    .maybeSingle();
  return Number((data as any)?.points ?? 0);
}

export async function getAllBalances(): Promise<any[]> {
  const { data } = await supabase
    .from("loyalty_balances" as any)
    .select("*")
    .order("points", { ascending: false });
  return (data as any[]) ?? [];
}

async function applyDelta(
  key: string,
  delta: number,
  meta: {
    kind: "earn" | "redeem" | "adjust";
    orderId?: string | null;
    value?: number;
    note?: string;
    customer?: { id?: string | null; name?: string | null; phone?: string | null };
  },
) {
  if (!key) return 0;
  const current = await getBalance(key);
  const next = Math.max(0, current + delta);
  const row: any = {
    customer_key: key,
    points: next,
    updated_at: new Date().toISOString(),
  };
  if (meta.customer) {
    if (meta.customer.id) row.customer_id = meta.customer.id;
    if (meta.customer.name) row.customer_name = meta.customer.name;
    if (meta.customer.phone) row.customer_phone = meta.customer.phone;
  }
  await supabase.from("loyalty_balances" as any).upsert(row, { onConflict: "customer_key" });
  await supabase.from("loyalty_transactions" as any).insert({
    customer_key: key,
    order_id: meta.orderId ?? null,
    kind: meta.kind,
    delta,
    value: meta.value ?? 0,
    note: meta.note ?? null,
  } as any);
  emit();
  return next;
}

/** Award points for a purchase. Returns points added. */
export async function awardForPurchase(
  key: string,
  amount: number,
  orderId?: string | null,
  customer?: { id?: string | null; name?: string | null; phone?: string | null },
): Promise<number> {
  const pts = pointsFor(amount);
  if (pts > 0)
    await applyDelta(key, pts, { kind: "earn", orderId, customer, note: `Earned from order` });
  return pts;
}

/** Redeem points -> returns currency value, or 0 if not enough. */
export async function redeem(
  key: string,
  points: number,
  orderId?: string | null,
): Promise<number> {
  const cfg = getConfig();
  const bal = await getBalance(key);
  if (points < cfg.minRedeem || points > bal || points <= 0) return 0;
  const value = points * cfg.redeemValue;
  await applyDelta(key, -points, { kind: "redeem", orderId, value, note: `Redeemed on order` });
  return value;
}

/** Manual adjust by signed delta. */
export async function adjust(key: string, delta: number) {
  return applyDelta(key, delta, { kind: "adjust", note: "Manual adjust" });
}

export async function setBalance(key: string, value: number) {
  const current = await getBalance(key);
  return applyDelta(key, value - current, { kind: "adjust", note: "Manual set" });
}
