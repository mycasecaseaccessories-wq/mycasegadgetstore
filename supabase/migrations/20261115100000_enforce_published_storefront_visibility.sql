-- Public catalogue visibility must respect the explicit publish flag.
DROP POLICY IF EXISTS "public read active products" ON public.products;
CREATE POLICY "public read published active products"
  ON public.products FOR SELECT TO anon, authenticated
  USING (status = 'ACTIVE' AND published = true);

DROP POLICY IF EXISTS "public read active variants" ON public.product_variants;
CREATE POLICY "public read variants of published products"
  ON public.product_variants FOR SELECT TO anon, authenticated
  USING (
    status = 'ACTIVE'
    AND EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = product_variants.product_id
        AND p.status = 'ACTIVE'
        AND p.published = true
    )
  );

DROP POLICY IF EXISTS "public read live sale products" ON public.sale_campaign_products;
CREATE POLICY "public read sale links for published products"
  ON public.sale_campaign_products FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sale_campaigns c
      WHERE c.id = sale_campaign_products.campaign_id
        AND c.status = 'ACTIVE'
        AND now() >= c.starts_at
        AND now() < c.ends_at
    )
    AND EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = sale_campaign_products.product_id
        AND p.status = 'ACTIVE'
        AND p.published = true
    )
  );
