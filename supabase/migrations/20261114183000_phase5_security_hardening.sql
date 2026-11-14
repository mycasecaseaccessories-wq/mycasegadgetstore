-- Phase 5 hardening for the isolated test schema.
-- Keep customer-facing reads available while removing unnecessary anonymous DML
-- and retiring obsolete checkout RPC overloads.

-- The application now calls the 7-argument member RPC with p_items jsonb and
-- p_redeem_points integer, and the 3-argument payment finalizer with a guest
-- capability. Retire legacy overloads left by earlier migrations.
DROP FUNCTION IF EXISTS public.create_order_with_items(
  text, text, text, numeric, numeric, integer, jsonb
);
DROP FUNCTION IF EXISTS public.finalize_order_payment_details(uuid, uuid);

-- Trigger-only functions must not be callable as public RPC endpoints.
REVOKE ALL ON FUNCTION public.sync_purchase_order_receipt_status()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.prevent_received_line_reversal()
  FROM PUBLIC, anon, authenticated, service_role;

-- This helper only returns fields intentionally readable from the public
-- settings row; run it with caller privileges so RLS/column grants still apply.
ALTER FUNCTION public.get_public_store_settings() SECURITY INVOKER;
GRANT EXECUTE ON FUNCTION public.get_public_store_settings()
  TO anon, authenticated;

-- Fix the mutable search_path warning on the trigger function.
CREATE OR REPLACE FUNCTION public.prevent_received_line_reversal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF OLD.cargo_status = 'arrived' AND NEW.cargo_status <> 'arrived' THEN
    RAISE EXCEPTION 'Received purchase item cannot be moved backwards after stock-in';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.prevent_received_line_reversal()
  FROM PUBLIC, anon, authenticated, service_role;

-- Remove default anonymous table privileges and re-grant only the catalog,
-- checkout-payment and active-campaign reads that the storefront requires.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;

GRANT SELECT (
  id, name, size, price, waiting_time, stock_status, category, note,
  created_at, updated_at, product_code, brand, status, stock_in, sold_qty,
  thb_price, final_sell_mmk, image_url, low_stock_threshold,
  selling_mode, availability, preorder_enabled, preorder_deposit,
  preorder_deposit_type, reserved_qty, published,
  description, highlights, specifications, warranty_info, shipping_info,
  gallery_images, description_images
) ON public.products TO anon;

GRANT SELECT (
  id, product_id, variant_code, name, size, color, price, thb_price,
  final_sell_mmk, stock_in, sold_qty, status, note, created_at, updated_at,
  selling_mode, preorder_enabled, preorder_deposit, preorder_deposit_type,
  waiting_time, reserved_qty, image_url
) ON public.product_variants TO anon;

GRANT SELECT (business_name, logo_url)
  ON public.settings TO anon;

GRANT SELECT (
  id, provider, account_name, account_number, bank_name, note, qr_url,
  is_active, sort_order
) ON public.payment_methods TO anon;

GRANT SELECT ON public.sale_campaigns TO anon;
GRANT SELECT ON public.sale_campaign_products TO anon;

-- Signed-in customers use the authenticated Postgres role even when browsing
-- the public shop. Give that role the same active-catalog read policies.
DROP POLICY IF EXISTS "public read active products" ON public.products;
CREATE POLICY "public read active products"
  ON public.products FOR SELECT TO anon, authenticated
  USING (status = 'ACTIVE');

DROP POLICY IF EXISTS "public read active variants" ON public.product_variants;
CREATE POLICY "public read active variants"
  ON public.product_variants FOR SELECT TO anon, authenticated
  USING (status = 'ACTIVE');

DROP POLICY IF EXISTS "public read store settings" ON public.settings;
CREATE POLICY "public read store settings"
  ON public.settings FOR SELECT TO anon, authenticated
  USING (true);

-- Add indexes for foreign keys flagged by the Performance Advisor.
CREATE INDEX IF NOT EXISTS idx_orders_payment_method_id
  ON public.orders(payment_method_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po_id
  ON public.purchase_order_items(po_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_product_id
  ON public.purchase_order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_id
  ON public.purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_sale_campaigns_created_by
  ON public.sale_campaigns(created_by);
CREATE INDEX IF NOT EXISTS idx_vouchers_order_id
  ON public.vouchers(order_id);

-- user_roles already has a UNIQUE(user_id, role) constraint and its backing
-- unique index. Remove the redundant second unique index.
DROP INDEX IF EXISTS public.user_roles_user_role_uidx;

NOTIFY pgrst, 'reload schema';
