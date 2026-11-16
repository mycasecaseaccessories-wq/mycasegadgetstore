-- Restore the sale-campaign schema required by preorder checkout pricing.
-- This schema was present in the live database but was missing from the
-- repository migration history, which left a fresh test project incomplete.

CREATE TABLE IF NOT EXISTS public.sale_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  badge_text text NOT NULL DEFAULT 'SALE',
  discount_type text NOT NULL,
  discount_value numeric NOT NULL,
  scope text NOT NULL DEFAULT 'ALL_ACTIVE',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  priority integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'DRAFT',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sale_campaigns_name_check
    CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  CONSTRAINT sale_campaigns_badge_text_check
    CHECK (char_length(btrim(badge_text)) BETWEEN 1 AND 40),
  CONSTRAINT sale_campaigns_discount_type_check
    CHECK (discount_type IN ('PERCENTAGE', 'FIXED')),
  CONSTRAINT sale_campaigns_discount_value_check
    CHECK (discount_value > 0),
  CONSTRAINT sale_campaigns_check1
    CHECK (discount_type <> 'PERCENTAGE' OR discount_value <= 100),
  CONSTRAINT sale_campaigns_scope_check
    CHECK (scope IN ('ALL_ACTIVE', 'IN_STOCK', 'SELECTED_PRODUCTS')),
  CONSTRAINT sale_campaigns_status_check
    CHECK (status IN ('DRAFT', 'ACTIVE', 'PAUSED', 'ENDED')),
  CONSTRAINT sale_campaigns_check
    CHECK (ends_at > starts_at),
  CONSTRAINT sale_campaigns_priority_check
    CHECK (priority BETWEEN 0 AND 100000)
);

CREATE TABLE IF NOT EXISTS public.sale_campaign_products (
  campaign_id uuid NOT NULL REFERENCES public.sale_campaigns(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_sale_campaigns_live
  ON public.sale_campaigns (status, starts_at, ends_at, priority DESC);
CREATE INDEX IF NOT EXISTS idx_sale_campaign_products_product
  ON public.sale_campaign_products (product_id, campaign_id);

ALTER TABLE public.sale_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_campaign_products ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.sale_campaigns TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_campaigns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_campaigns TO service_role;
GRANT SELECT ON public.sale_campaign_products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_campaign_products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_campaign_products TO service_role;

DROP POLICY IF EXISTS "public read live sale campaigns" ON public.sale_campaigns;
CREATE POLICY "public read live sale campaigns"
  ON public.sale_campaigns FOR SELECT TO anon, authenticated
  USING (status = 'ACTIVE' AND now() >= starts_at AND now() < ends_at);

DROP POLICY IF EXISTS "staff manage sale campaigns" ON public.sale_campaigns;
CREATE POLICY "staff manage sale campaigns"
  ON public.sale_campaigns FOR ALL TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR private.has_role(auth.uid(), 'staff'::public.app_role)
  )
  WITH CHECK (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR private.has_role(auth.uid(), 'staff'::public.app_role)
  );

DROP POLICY IF EXISTS "public read live sale products" ON public.sale_campaign_products;
CREATE POLICY "public read live sale products"
  ON public.sale_campaign_products FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sale_campaigns c
      WHERE c.id = sale_campaign_products.campaign_id
        AND c.status = 'ACTIVE'
        AND now() >= c.starts_at
        AND now() < c.ends_at
    )
  );

DROP POLICY IF EXISTS "staff manage sale products" ON public.sale_campaign_products;
CREATE POLICY "staff manage sale products"
  ON public.sale_campaign_products FOR ALL TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR private.has_role(auth.uid(), 'staff'::public.app_role)
  )
  WITH CHECK (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR private.has_role(auth.uid(), 'staff'::public.app_role)
  );

CREATE OR REPLACE FUNCTION public.set_sale_campaign_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_sale_campaign_updated_at() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_sale_campaign_updated_at ON public.sale_campaigns;
CREATE TRIGGER trg_sale_campaign_updated_at
  BEFORE UPDATE ON public.sale_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_sale_campaign_updated_at();

-- The pricing helper only reads public, currently active campaign data.
-- SECURITY INVOKER preserves the table RLS policies for anon/authenticated.
CREATE OR REPLACE FUNCTION public.get_active_sale_for_item(
  p_product_id uuid,
  p_variant_id uuid,
  p_base_price numeric
)
RETURNS TABLE (
  campaign_id uuid,
  badge_text text,
  original_price numeric,
  sale_price numeric,
  discount_amount numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH candidates AS (
    SELECT c.id, c.badge_text, c.discount_type, c.discount_value,
           c.priority, c.created_at
    FROM public.sale_campaigns c
    WHERE c.status = 'ACTIVE'
      AND now() >= c.starts_at
      AND now() < c.ends_at
      AND (
        c.scope IN ('ALL_ACTIVE', 'IN_STOCK')
        OR (
          c.scope = 'SELECTED_PRODUCTS'
          AND EXISTS (
            SELECT 1
            FROM public.sale_campaign_products cp
            WHERE cp.campaign_id = c.id
              AND cp.product_id = p_product_id
          )
        )
      )
      AND p_base_price >= 0
    ORDER BY c.priority DESC, c.created_at DESC
    LIMIT 1
  ),
  priced AS (
    SELECT id, badge_text, discount_type, discount_value,
           p_base_price AS original_price
    FROM candidates
  )
  SELECT
    id,
    badge_text,
    original_price,
    CASE
      WHEN discount_type = 'PERCENTAGE'
        THEN GREATEST(0, ROUND(original_price * (1 - discount_value / 100), 0))
      ELSE GREATEST(0, ROUND(original_price - discount_value, 0))
    END AS sale_price,
    CASE
      WHEN discount_type = 'PERCENTAGE'
        THEN LEAST(original_price, ROUND(original_price * discount_value / 100, 0))
      ELSE LEAST(original_price, ROUND(discount_value, 0))
    END AS discount_amount
  FROM priced;
$$;

REVOKE ALL ON FUNCTION public.get_active_sale_for_item(uuid, uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_sale_for_item(uuid, uuid, numeric)
  TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
