-- Second-pass hardening: atomically create an order, its items, and an optional
-- loyalty redemption. This function is intentionally authenticated-only and
-- derives user_id from auth.uid(); callers cannot create another user's order.
CREATE OR REPLACE FUNCTION public.create_order_with_items(
  p_customer_name text,
  p_customer_phone text,
  p_delivery_note text,
  p_discount numeric,
  p_extra_fee numeric,
  p_items jsonb,
  p_redeem_points integer DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_order_id uuid;
  v_subtotal numeric := 0;
  v_discount numeric := COALESCE(p_discount, 0);
  v_extra_fee numeric := COALESCE(p_extra_fee, 0);
  v_redeem_points integer := COALESCE(p_redeem_points, 0);
  v_redeem_value numeric := 0;
  v_total numeric;
  v_balance integer := 0;
  v_min_redeem integer := 0;
  v_redeem_rate numeric := 0;
  v_key text := NULLIF(btrim(COALESCE(p_customer_phone, '')), '');
  item jsonb;
  v_unit_price numeric;
  v_quantity integer;
  v_line_total numeric;
  v_product_id uuid;
  v_product_name text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one order item is required';
  END IF;
  IF v_discount < 0 OR v_extra_fee < 0
     OR v_discount <> v_discount OR v_extra_fee <> v_extra_fee
     OR abs(v_discount) >= 1000000000000 OR abs(v_extra_fee) >= 1000000000000 THEN
    RAISE EXCEPTION 'Invalid discount or extra fee';
  END IF;
  IF v_redeem_points < 0 THEN
    RAISE EXCEPTION 'Invalid loyalty points';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    BEGIN
      v_unit_price := (item ->> 'unit_price')::numeric;
      v_quantity := (item ->> 'quantity')::integer;
      v_line_total := (item ->> 'line_total')::numeric;
      v_product_id := NULLIF(item ->> 'product_id', '')::uuid;
      v_product_name := NULLIF(btrim(item ->> 'product_name'), '');
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Malformed order item';
    END;

    IF v_product_name IS NULL OR v_unit_price IS NULL OR v_quantity IS NULL
       OR v_unit_price < 0 OR v_quantity <= 0
       OR v_unit_price <> v_unit_price OR v_line_total <> v_line_total
       OR abs(v_unit_price) >= 1000000000000
       OR v_quantity > 1000000 THEN
      RAISE EXCEPTION 'Invalid order item values';
    END IF;
    IF v_line_total IS NULL OR abs(v_line_total - (v_unit_price * v_quantity)) > 0.01 THEN
      RAISE EXCEPTION 'Invalid order item total';
    END IF;
    v_subtotal := v_subtotal + (v_unit_price * v_quantity);
  END LOOP;

  IF v_subtotal < 0 OR v_subtotal <> v_subtotal OR abs(v_subtotal) >= 1000000000000 THEN
    RAISE EXCEPTION 'Invalid subtotal';
  END IF;

  IF v_redeem_points > 0 THEN
    IF v_key IS NULL THEN
      RAISE EXCEPTION 'A phone number is required to redeem points';
    END IF;
    SELECT COALESCE(loyalty_min_redeem, 0), COALESCE(loyalty_redeem_value, 0)
      INTO v_min_redeem, v_redeem_rate
      FROM public.settings
      ORDER BY updated_at DESC
      LIMIT 1;
    IF v_redeem_points < v_min_redeem OR v_redeem_rate <= 0 THEN
      RAISE EXCEPTION 'Invalid loyalty redemption';
    END IF;
    SELECT points INTO v_balance
      FROM public.loyalty_balances
      WHERE customer_key = v_key
      FOR UPDATE;
    IF COALESCE(v_balance, 0) < v_redeem_points THEN
      RAISE EXCEPTION 'Insufficient loyalty points';
    END IF;
    v_redeem_value := v_redeem_points * v_redeem_rate;
  END IF;

  v_total := v_subtotal - v_discount + v_extra_fee - v_redeem_value;
  IF v_total < 0 OR v_total <> v_total OR abs(v_total) >= 1000000000000 THEN
    RAISE EXCEPTION 'Invalid order total';
  END IF;

  INSERT INTO public.orders (
    user_id, customer_name, customer_phone, delivery_note,
    subtotal, discount, extra_fee, total, points_redeemed, points_value,
    status, payment_status
  ) VALUES (
    v_user_id, NULLIF(btrim(p_customer_name), ''), v_key, p_delivery_note,
    v_subtotal, v_discount + v_redeem_value, v_extra_fee, v_total,
    v_redeem_points, v_redeem_value, 'pending', 'unpaid'
  ) RETURNING id INTO v_order_id;

  FOR item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.order_items (
      order_id, product_id, product_name, unit_price, quantity, line_total
    ) VALUES (
      v_order_id,
      NULLIF(item ->> 'product_id', '')::uuid,
      btrim(item ->> 'product_name'),
      (item ->> 'unit_price')::numeric,
      (item ->> 'quantity')::integer,
      (item ->> 'unit_price')::numeric * (item ->> 'quantity')::integer
    );
  END LOOP;

  IF v_redeem_points > 0 THEN
    UPDATE public.loyalty_balances
      SET points = points - v_redeem_points,
          updated_at = now()
      WHERE customer_key = v_key;
    INSERT INTO public.loyalty_transactions (
      customer_key, order_id, kind, delta, value, note
    ) VALUES (
      v_key, v_order_id, 'redeem', -v_redeem_points, v_redeem_value,
      'Redeemed at checkout'
    );
  END IF;

  RETURN v_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_order_with_items(text, text, text, numeric, numeric, jsonb, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_order_with_items(text, text, text, numeric, numeric, jsonb, integer) TO authenticated;

-- A small, explicit storefront surface keeps internal configuration private.
CREATE OR REPLACE FUNCTION public.get_public_store_settings()
RETURNS TABLE (business_name text, logo_url text, currency text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.business_name, s.logo_url, s.currency
  FROM public.settings s
  ORDER BY s.updated_at DESC
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_public_store_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_store_settings() TO anon, authenticated;

-- Anonymous storefront reads are column-scoped; customer/order/payment data is
-- not readable anonymously, and anonymous financial inserts are disabled.
DROP POLICY IF EXISTS "public read settings" ON public.settings;
REVOKE SELECT ON public.settings FROM anon;
GRANT SELECT (business_name, logo_url, currency) ON public.settings TO anon;
CREATE POLICY "public read store settings" ON public.settings
  FOR SELECT TO anon USING (true);

REVOKE SELECT ON public.products FROM anon;
GRANT SELECT (
  id, name, size, price, image_url, brand, category, waiting_time,
  stock_status, stock_in, sold_qty, final_sell_mmk, product_code, status, created_at
) ON public.products TO anon;

REVOKE SELECT ON public.product_variants FROM anon;
GRANT SELECT (
  id, product_id, variant_code, name, size, color, price, final_sell_mmk,
  stock_in, sold_qty, status
) ON public.product_variants TO anon;

DROP POLICY IF EXISTS "public insert customers" ON public.customers;
DROP POLICY IF EXISTS "public insert orders" ON public.orders;
DROP POLICY IF EXISTS "public insert order_items" ON public.order_items;
