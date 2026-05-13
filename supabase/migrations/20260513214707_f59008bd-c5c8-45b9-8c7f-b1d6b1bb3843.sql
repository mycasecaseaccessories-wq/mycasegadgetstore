
-- ============================================================
-- 1) LOYALTY CONFIG → move to settings (server-trusted source)
-- ============================================================
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS loyalty_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS loyalty_earn_per_amount numeric NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS loyalty_redeem_value numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS loyalty_min_redeem integer NOT NULL DEFAULT 50;

-- ============================================================
-- 2) DROP ANON INSERT on orders / order_items / customers
--    Storefront checkout will require auth (shop login).
-- ============================================================
DROP POLICY IF EXISTS "public insert orders" ON public.orders;
DROP POLICY IF EXISTS "public insert order_items" ON public.order_items;
DROP POLICY IF EXISTS "public insert customers" ON public.customers;

-- ============================================================
-- 3) LOCK SENSITIVE COLUMNS for anon role (column-level GRANTs)
-- ============================================================
-- products: hide internal pricing/margin internals
REVOKE SELECT ON public.products FROM anon;
GRANT SELECT (
  id, name, size, price, waiting_time, stock_status, category, note,
  created_at, updated_at, product_code, brand, status, stock_in, sold_qty,
  thb_price, final_sell_mmk, image_url, low_stock_threshold
) ON public.products TO anon;

-- product_variants: hide thb cost
REVOKE SELECT ON public.product_variants FROM anon;
GRANT SELECT (
  id, product_id, variant_code, name, size, color, price,
  final_sell_mmk, stock_in, sold_qty, status, note, created_at, updated_at
) ON public.product_variants TO anon;

-- settings: only public branding fields for anon
REVOKE SELECT ON public.settings FROM anon;
GRANT SELECT (
  id, business_name, logo_url, currency, language, default_waiting_time
) ON public.settings TO anon;

-- ============================================================
-- 4) FIX role trigger: only first user becomes admin.
--    Subsequent signups (e.g. shop customers) get NO role row,
--    so they cannot reach admin tables via auth.uid()-only RLS.
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _count int;
BEGIN
  SELECT count(*) INTO _count FROM public.user_roles;
  IF _count = 0 THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::public.app_role)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

-- Tighten admin-table policies: require an admin/staff role row
-- so a random shop customer (no role) cannot read/write them.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'expenses','purchase_orders','purchase_order_items','suppliers',
    'rates','product_variants','vouchers','notes','products','settings'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "auth all %1$s" ON public.%1$s;', t);
    EXECUTE format($f$
      CREATE POLICY "staff manage %1$s" ON public.%1$s
        FOR ALL TO authenticated
        USING (private.has_role(auth.uid(),'admin'::app_role) OR private.has_role(auth.uid(),'staff'::app_role))
        WITH CHECK (private.has_role(auth.uid(),'admin'::app_role) OR private.has_role(auth.uid(),'staff'::app_role));
    $f$, t);
  END LOOP;
END $$;

-- Re-grant anon SELECT through column lists is preserved above.
-- Re-add the public SELECT policies that anon needs:
-- (they were dropped together with "auth all" if same name; recreate)
DROP POLICY IF EXISTS "public read active products" ON public.products;
CREATE POLICY "public read active products" ON public.products
  FOR SELECT TO anon USING (status = 'ACTIVE');

DROP POLICY IF EXISTS "public read active variants" ON public.product_variants;
CREATE POLICY "public read active variants" ON public.product_variants
  FOR SELECT TO anon USING (status = 'ACTIVE');

DROP POLICY IF EXISTS "public read settings" ON public.settings;
CREATE POLICY "public read settings" ON public.settings
  FOR SELECT TO anon USING (true);

-- ============================================================
-- 5) PAYMENT METHODS — manual list (Wave/KBZ/AYA/Binance, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,             -- e.g. "Wave Money", "KBZ Pay", "Binance"
  account_name text NOT NULL,
  account_number text NOT NULL,
  bank_name text,
  note text,
  qr_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

-- Admin/staff can fully manage
CREATE POLICY "staff manage payment_methods" ON public.payment_methods
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role) OR private.has_role(auth.uid(),'staff'::app_role))
  WITH CHECK (private.has_role(auth.uid(),'admin'::app_role) OR private.has_role(auth.uid(),'staff'::app_role));

-- Public (anon + auth) can read ACTIVE methods to display at checkout
CREATE POLICY "public read active payment_methods" ON public.payment_methods
  FOR SELECT TO anon, authenticated USING (is_active = true);

CREATE TRIGGER set_payment_methods_updated_at
  BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
