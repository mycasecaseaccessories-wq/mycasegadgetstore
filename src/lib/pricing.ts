export type ProfitMode = "FIXED" | "PERCENT" | "BOTH";
export type RoundingRule = "NO_ROUND" | "NEAREST_100" | "NEAREST_500" | "NEAREST_1000";
export type MinimumPriceMode = "base_sell_plus_extra" | "buy_plus_extra_plus_buffer";

export interface PricingInput {
  thbPrice: number;
  buyRate: number;
  sellGap?: number;
  cargoMMK?: number;
  deliMMK?: number;
  otherMMK?: number;
  profitMode?: ProfitMode;
  fixedProfit?: number;
  percentProfit?: number;
  roundingRule?: RoundingRule;
  minimumPriceMode?: MinimumPriceMode;
  minimumBuffer?: number;
}

export interface PricingResult {
  appliedBuyRate: number;
  appliedSellRate: number;
  mmkBuyPrice: number;
  baseSellPriceMMK: number;
  totalExtraCost: number;
  costBeforeProfit: number;
  finalSellMMK: number;
  trueNetProfit: number;
  marginPercent: number;
  minimumPriceMMK: number;
  belowMinimum: boolean;
}

function applyRounding(v: number, rule?: RoundingRule) {
  if (rule === "NEAREST_100") return Math.round(v / 100) * 100;
  if (rule === "NEAREST_500") return Math.round(v / 500) * 500;
  if (rule === "NEAREST_1000") return Math.round(v / 1000) * 1000;
  return v;
}

export function calculatePricing(input: PricingInput): PricingResult {
  const thb = Math.max(0, +input.thbPrice || 0);
  const buy = Math.max(0, +input.buyRate || 0);
  const gap = Math.max(0, +(input.sellGap ?? 0));
  const cargo = Math.max(0, +(input.cargoMMK ?? 0));
  const deli = Math.max(0, +(input.deliMMK ?? 0));
  const other = Math.max(0, +(input.otherMMK ?? 0));
  const fixed = Math.max(0, +(input.fixedProfit ?? 0));
  const percent = Math.max(0, +(input.percentProfit ?? 0));
  const mode = input.profitMode ?? "PERCENT";
  const rounding = input.roundingRule ?? "NO_ROUND";
  const buffer = Math.max(0, +(input.minimumBuffer ?? 0));

  const empty: PricingResult = {
    appliedBuyRate: buy,
    appliedSellRate: buy + gap,
    mmkBuyPrice: 0,
    baseSellPriceMMK: 0,
    totalExtraCost: 0,
    costBeforeProfit: 0,
    finalSellMMK: 0,
    trueNetProfit: 0,
    marginPercent: 0,
    minimumPriceMMK: 0,
    belowMinimum: false,
  };
  if (thb <= 0 || buy <= 0) return empty;

  const sellRate = buy + gap;
  const mmkBuy = thb * buy;
  const baseSell = thb * sellRate;
  const extra = cargo + deli + other;
  const cost = baseSell + extra;

  let raw: number;
  if (mode === "FIXED") raw = cost + fixed;
  else if (mode === "PERCENT") raw = cost * (1 + percent / 100);
  else raw = cost + fixed + (cost * percent) / 100;

  const minimum =
    input.minimumPriceMode === "buy_plus_extra_plus_buffer"
      ? mmkBuy + extra + buffer
      : baseSell + extra;
  const enforced = Math.max(raw, minimum);
  const final = applyRounding(enforced, rounding);
  const profit = final - (mmkBuy + extra);

  return {
    appliedBuyRate: buy,
    appliedSellRate: sellRate,
    mmkBuyPrice: Math.round(mmkBuy),
    baseSellPriceMMK: Math.round(baseSell),
    totalExtraCost: Math.round(extra),
    costBeforeProfit: Math.round(cost),
    finalSellMMK: Math.round(final),
    trueNetProfit: Math.round(profit),
    marginPercent: mmkBuy > 0 ? Math.round((profit / mmkBuy) * 1000) / 10 : 0,
    minimumPriceMMK: Math.round(minimum),
    belowMinimum: raw < minimum,
  };
}
