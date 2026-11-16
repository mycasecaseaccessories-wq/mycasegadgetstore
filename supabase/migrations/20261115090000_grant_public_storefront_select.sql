-- Public storefront reads: RLS policies already restrict rows; grant the
-- corresponding table-level SELECT privilege so anon/authenticated clients can
-- actually use those policies. No write privileges are granted.
GRANT SELECT ON TABLE
  public.products,
  public.product_variants,
  public.payment_methods,
  public.sale_campaigns,
  public.sale_campaign_products,
  public.settings
TO anon, authenticated;
