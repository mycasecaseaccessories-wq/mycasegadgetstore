// Phase 19 — Customer loyalty / points (client-side, localStorage).
// Additive: no DB changes. Admin can configure rules and adjust balances.

const CFG_KEY = "mycase.loyalty.config.v1";
const BAL_KEY = "mycase.loyalty.balances.v1";

export interface LoyaltyConfig {
  enabled: boolean;
  earnPerAmount: number;   // amount in active currency that earns 1 point
  redeemValue: number;     // 1 point = X currency units when redeemed
  minRedeem: number;       // minimum points required to redeem
}

const DEFAULT_CONFIG: LoyaltyConfig = {
  enabled: true,
  earnPerAmount: 1000,
  redeemValue: 1,
  minRedeem: 50,
};

export type Balances = Record<string, number>;

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

export function getBalances(): Balances {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(BAL_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveBalances(b: Balances) {
  localStorage.setItem(BAL_KEY, JSON.stringify(b));
  emit();
}

export function getBalance(key: string): number {
  return getBalances()[key] ?? 0;
}

/** Compute points earned from a purchase amount based on config. */
export function pointsFor(amount: number): number {
  const cfg = getConfig();
  if (!cfg.enabled || cfg.earnPerAmount <= 0) return 0;
  return Math.floor(amount / cfg.earnPerAmount);
}

/** Award points for a purchase. Returns points added. */
export function awardForPurchase(key: string, amount: number): number {
  const pts = pointsFor(amount);
  if (pts > 0) adjust(key, pts);
  return pts;
}

/** Redeem points -> returns currency value, or 0 if not enough. */
export function redeem(key: string, points: number): number {
  const cfg = getConfig();
  const bal = getBalance(key);
  if (points < cfg.minRedeem || points > bal) return 0;
  adjust(key, -points);
  return points * cfg.redeemValue;
}

/** Manual adjust by signed delta. */
export function adjust(key: string, delta: number) {
  const b = getBalances();
  b[key] = Math.max(0, (b[key] ?? 0) + delta);
  saveBalances(b);
}

export function setBalance(key: string, value: number) {
  const b = getBalances();
  b[key] = Math.max(0, value);
  saveBalances(b);
}
