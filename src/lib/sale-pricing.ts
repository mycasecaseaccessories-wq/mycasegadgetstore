export type SaleCampaign = {
  id: string;
  badge_text: string;
  discount_type: "PERCENTAGE" | "FIXED";
  discount_value: number | string;
  scope: "ALL_ACTIVE" | "IN_STOCK" | "SELECTED_PRODUCTS";
  priority: number;
  created_at: string;
};

export type SaleProductLink = {
  campaign_id: string;
  product_id: string;
};

export type SalePrice = {
  sale_campaign_id: string;
  sale_badge_text: string;
  original_price: number;
  sale_price: number;
  discount_amount: number;
};

export function getSalePrice(
  productId: string,
  basePrice: number,
  campaigns: SaleCampaign[],
  productLinks: SaleProductLink[],
): SalePrice | null {
  if (!Number.isFinite(basePrice) || basePrice < 0) return null;

  const linkedCampaignIds = new Set(
    productLinks
      .filter((link) => link.product_id === productId)
      .map((link) => link.campaign_id),
  );

  const campaign = [...campaigns]
    .sort((a, b) => Number(b.priority) - Number(a.priority) || b.created_at.localeCompare(a.created_at))
    .find((item) =>
      item.scope === "ALL_ACTIVE" ||
      item.scope === "IN_STOCK" ||
      (item.scope === "SELECTED_PRODUCTS" && linkedCampaignIds.has(item.id)),
    );

  if (!campaign) return null;

  const discountValue = Math.max(0, Number(campaign.discount_value) || 0);
  const discountAmount = campaign.discount_type === "PERCENTAGE"
    ? Math.min(basePrice, Math.round(basePrice * discountValue / 100))
    : Math.min(basePrice, Math.round(discountValue));
  const salePrice = campaign.discount_type === "PERCENTAGE"
    ? Math.max(0, Math.round(basePrice * (1 - discountValue / 100)))
    : Math.max(0, Math.round(basePrice - discountValue));

  if (discountAmount <= 0 || salePrice >= basePrice) return null;

  return {
    sale_campaign_id: campaign.id,
    sale_badge_text: campaign.badge_text,
    original_price: basePrice,
    sale_price: salePrice,
    discount_amount: discountAmount,
  };
}
