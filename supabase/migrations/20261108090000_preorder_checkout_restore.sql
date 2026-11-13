-- Restore the pre-order path without weakening the in-stock inventory lock.
-- In-stock items reserve inventory immediately. Pre-order items reserve no stock
-- until fulfill_preorder_order is run after stock arrives.

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
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_order_id uuid;
  v_subtotal numeric := 0;
  v_discount numeric := CASE
    WHEN private.has_role(auth.uid(), 'admin'::public.app_role)
      OR private.has_role(auth.uid(), 'staff'::public.app_role)
    THEN COALESCE(p_discount, 0) ELSE 0 END;
  v_extra_fee numeric := COALESCE(p_extra_fee, 0);
  v_redeem_points integer := COALESCE(p_redeem_points, 0);
  v_redeem_value numeric := 0;
  v_total numeric;
  v_balance integer := 0;
  v_min_redeem integer := 0;
  v_redeem_rate numeric := 0;
  v_key text := NULLIF(btrim(COALESCE(p_customer_phone, '')), '');
  v_product record;
  v_variant record;
  v_product_id uuid;
  v_variant_id uuid;
  v_quantity integer;
  v_server_price numeric;
  v_original_price numeric;
  v_sale_discount numeric := 0;
  v_sale_discount_total numeric := 0;
  v_sale_campaign_id uuid;
  v_available integer;
  v_fulfillment text;
  v_eta text;
  v_deposit numeric;
  v_deposit_setting numeric;
  v_deposit_type text;
  item jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sign in is required to use member checkout';
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one order item is required';
  END IF;
  IF NULLIF(btrim(COALESCE(p_customer_name, '')), '') IS NULL OR v_key IS NULL THEN
    RAISE EXCEPTION 'Name and phone are required';
  END IF;
  IF v_discount < 0 OR v_extra_fee < 0 OR v_redeem_points < 0 THEN
    RAISE EXCEPTION 'Invalid discount, fee, or loyalty points';
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    BEGIN
      v_product_id := NULLIF(item ->> 'product_id', '')::uuid;
      v_variant_id := NULLIF(item ->> 'variant_id', '')::uuid;
      v_quantity := (item ->> 'quantity')::integer;
      v_fulfillment := upper(COALESCE(NULLIF(item ->> 'fulfillment_type', ''), 'IN_STOCK'));
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Malformed order item';
    END;

    IF v_product_id IS NULL OR v_quantity IS NULL OR v_quantity <= 0 OR v_quantity > 1000 THEN
      RAISE EXCEPTION 'Invalid order item values';
    END IF;
    IF v_fulfillment NOT IN ('IN_STOCK', 'PREORDER') THEN
      RAISE EXCEPTION 'Invalid fulfillment type';
    END IF;

    SELECT * INTO v_product
    FROM public.products
    WHERE id = v_product_id AND status = 'ACTIVE'
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Product is unavailable'; END IF;

    IF v_variant_id IS NOT NULL THEN
      SELECT * INTO v_variant
      FROM public.product_variants
      WHERE id = v_variant_id AND product_id = v_product_id AND status = 'ACTIVE'
      FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Selected variant is unavailable'; END IF;

      v_server_price := COALESCE(v_variant.final_sell_mmk, v_variant.price, 0);
      IF v_server_price < 0 THEN RAISE EXCEPTION 'Invalid product price'; END IF;

      IF v_fulfillment = 'PREORDER' THEN
        IF NOT COALESCE(v_variant.preorder_enabled, false)
          OR COALESCE(v_variant.selling_mode, 'IN_STOCK') NOT IN ('PREORDER', 'BOTH') THEN
          RAISE EXCEPTION 'Pre-order is not available for this variant';
        END IF;
        v_available := COALESCE(v_variant.stock_in, 0)
          - COALESCE(v_variant.sold_qty, 0)
          - COALESCE(v_variant.reserved_qty, 0);
        IF COALESCE(v_variant.selling_mode, 'IN_STOCK') = 'BOTH' AND v_available > 0 THEN
          RAISE EXCEPTION 'In-stock units are still available for this variant';
        END IF;
      ELSE
        v_available := COALESCE(v_variant.stock_in, 0)
          - COALESCE(v_variant.sold_qty, 0)
          - COALESCE(v_variant.reserved_qty, 0);
        IF v_available < v_quantity THEN
          RAISE EXCEPTION 'Insufficient stock for selected variant';
        END IF;
        UPDATE public.product_variants
        SET reserved_qty = COALESCE(reserved_qty, 0) + v_quantity, updated_at = now()
        WHERE id = v_variant_id;
      END IF;
    ELSE
      v_server_price := COALESCE(v_product.final_sell_mmk, v_product.price, 0);
      IF v_server_price < 0 THEN RAISE EXCEPTION 'Invalid product price'; END IF;

      IF v_fulfillment = 'PREORDER' THEN
        IF NOT COALESCE(v_product.preorder_enabled, false)
          OR COALESCE(v_product.selling_mode, 'IN_STOCK') NOT IN ('PREORDER', 'BOTH') THEN
          RAISE EXCEPTION 'Pre-order is not available for this product';
        END IF;
        v_available := COALESCE(v_product.stock_in, 0)
          - COALESCE(v_product.sold_qty, 0)
          - COALESCE(v_product.reserved_qty, 0);
        IF COALESCE(v_product.selling_mode, 'IN_STOCK') = 'BOTH' AND v_available > 0 THEN
          RAISE EXCEPTION 'In-stock units are still available for this product';
        END IF;
      ELSE
        v_available := COALESCE(v_product.stock_in, 0)
          - COALESCE(v_product.sold_qty, 0)
          - COALESCE(v_product.reserved_qty, 0);
        IF v_available < v_quantity THEN
          RAISE EXCEPTION 'Insufficient stock for %', v_product.name;
        END IF;
        UPDATE public.products
        SET reserved_qty = COALESCE(reserved_qty, 0) + v_quantity, updated_at = now()
        WHERE id = v_product_id;
      END IF;
    END IF;

    v_original_price := v_server_price;
    v_sale_campaign_id := NULL;
    v_sale_discount := 0;
    SELECT campaign_id, original_price, sale_price, discount_amount
    INTO v_sale_campaign_id, v_original_price, v_server_price, v_sale_discount
    FROM public.get_active_sale_for_item(v_product_id, v_variant_id, v_original_price);
    IF v_sale_campaign_id IS NULL THEN
      v_server_price := v_original_price;
      v_sale_discount := 0;
    END IF;
    v_subtotal := v_subtotal + (v_original_price * v_quantity);
    v_sale_discount_total := v_sale_discount_total + (v_sale_discount * v_quantity);
  END LOOP;

  IF v_redeem_points > 0 THEN
    SELECT COALESCE(loyalty_min_redeem, 0), COALESCE(loyalty_redeem_value, 0)
    INTO v_min_redeem, v_redeem_rate
    FROM public.settings ORDER BY updated_at DESC LIMIT 1;
    IF v_redeem_points < v_min_redeem OR v_redeem_rate <= 0 THEN
      RAISE EXCEPTION 'Invalid loyalty redemption';
    END IF;
    SELECT points INTO v_balance
    FROM public.loyalty_balances WHERE customer_key = v_key FOR UPDATE;
    IF COALESCE(v_balance, 0) < v_redeem_points THEN
      RAISE EXCEPTION 'Insufficient loyalty points';
    END IF;
    v_redeem_value := LEAST(
      v_subtotal - v_sale_discount_total - v_discount + v_extra_fee,
      v_redeem_points * v_redeem_rate
    );
  END IF;

  v_total := v_subtotal - v_sale_discount_total - v_discount + v_extra_fee - v_redeem_value;
  IF v_total < 0 THEN RAISE EXCEPTION 'Invalid order total'; END IF;

  INSERT INTO public.orders (
    user_id, customer_name, customer_phone, delivery_note, subtotal, discount,
    extra_fee, total, points_redeemed, points_value, status, payment_status
  ) VALUES (
    v_user_id, NULLIF(btrim(p_customer_name), ''), v_key, p_delivery_note,
    v_subtotal, v_discount + v_sale_discount_total + v_redeem_value,
    v_extra_fee, v_total, v_redeem_points, v_redeem_value, 'pending', 'unpaid'
  ) RETURNING id INTO v_order_id;

  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := NULLIF(item ->> 'product_id', '')::uuid;
    v_variant_id := NULLIF(item ->> 'variant_id', '')::uuid;
    v_quantity := (item ->> 'quantity')::integer;
    v_fulfillment := upper(COALESCE(NULLIF(item ->> 'fulfillment_type', ''), 'IN_STOCK'));

    IF v_variant_id IS NOT NULL THEN
      SELECT COALESCE(final_sell_mmk, price, 0), waiting_time,
        preorder_deposit, preorder_deposit_type
      INTO v_original_price, v_eta, v_deposit_setting, v_deposit_type
      FROM public.product_variants WHERE id = v_variant_id;
    ELSE
      SELECT COALESCE(final_sell_mmk, price, 0), waiting_time,
        preorder_deposit, preorder_deposit_type
      INTO v_original_price, v_eta, v_deposit_setting, v_deposit_type
      FROM public.products WHERE id = v_product_id;
    END IF;

    v_sale_discount := 0;
    v_sale_campaign_id := NULL;
    SELECT campaign_id, sale_price, discount_amount
    INTO v_sale_campaign_id, v_server_price, v_sale_discount
    FROM public.get_active_sale_for_item(v_product_id, v_variant_id, v_original_price);
    IF v_sale_campaign_id IS NULL THEN v_server_price := v_original_price; END IF;

    v_deposit := CASE
      WHEN upper(COALESCE(v_deposit_type, 'FIXED')) = 'PERCENTAGE'
        THEN LEAST(v_server_price, v_server_price * LEAST(100, GREATEST(0, COALESCE(v_deposit_setting, 0))) / 100)
      ELSE LEAST(v_server_price, GREATEST(0, COALESCE(v_deposit_setting, 0)))
    END;

    INSERT INTO public.order_items (
      order_id, product_id, variant_id, product_name, unit_price, quantity, line_total,
      fulfillment_type, estimated_arrival, deposit_required,
      original_unit_price, discount_amount, sale_campaign_id
    ) VALUES (
      v_order_id, v_product_id, v_variant_id,
      btrim(COALESCE(item ->> 'product_name', 'Product')),
      v_server_price, v_quantity, v_server_price * v_quantity,
      v_fulfillment,
      CASE WHEN v_fulfillment = 'PREORDER' THEN v_eta ELSE NULL END,
      CASE WHEN v_fulfillment = 'PREORDER' THEN v_deposit ELSE 0 END,
      v_original_price, COALESCE(v_sale_discount, 0), v_sale_campaign_id
    );
  END LOOP;

  IF v_redeem_points > 0 THEN
    UPDATE public.loyalty_balances
    SET points = points - v_redeem_points, updated_at = now()
    WHERE customer_key = v_key;
    INSERT INTO public.loyalty_transactions(customer_key, order_id, kind, delta, value, note)
    VALUES (v_key, v_order_id, 'redeem', -v_redeem_points, v_redeem_value, 'Redeemed at checkout');
  END IF;

  RETURN v_order_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_order_with_items(text, text, text, numeric, numeric, jsonb, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_order_with_items(text, text, text, numeric, numeric, jsonb, integer) TO authenticated, service_role;


-- Keep guest checkout aligned with member checkout: BOTH mode accepts a preorder
-- only after available inventory reaches zero. Guest capabilities remain hashed.
CREATE OR REPLACE FUNCTION public.create_guest_order_with_items(
  p_customer_name text,
  p_customer_phone text,
  p_delivery_note text,
  p_discount numeric,
  p_extra_fee numeric,
  p_items jsonb,
  p_redeem_points integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $function$
DECLARE
  v_order_id uuid;
  v_capability text := encode(extensions.gen_random_bytes(32), 'hex');
  v_digest text := encode(extensions.digest(v_capability, 'sha256'), 'hex');
  v_subtotal numeric := 0;
  v_sale_discount_total numeric := 0;
  v_sale_discount numeric := 0;
  v_sale_campaign_id uuid;
  v_original_price numeric;
  -- Guest callers are untrusted; never accept a client-supplied discount.
  v_discount numeric := 0;
  v_extra_fee numeric := COALESCE(p_extra_fee, 0);
  v_total numeric;
  v_product record;
  v_variant record;
  v_product_id uuid;
  v_variant_id uuid;
  v_quantity integer;
  v_server_price numeric;
  v_available integer;
  v_fulfillment text;
  v_deposit numeric;
  v_deposit_setting numeric;
  v_deposit_type text;
  v_eta text;
  item jsonb;
BEGIN
  IF auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Guest checkout required'; END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one order item is required';
  END IF;
  IF NULLIF(btrim(COALESCE(p_customer_name, '')), '') IS NULL
    OR NULLIF(btrim(COALESCE(p_customer_phone, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Name and phone are required';
  END IF;
  IF v_discount < 0 OR v_extra_fee < 0 OR COALESCE(p_redeem_points, 0) <> 0 THEN
    RAISE EXCEPTION 'Invalid guest checkout values';
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    BEGIN
      v_product_id := NULLIF(item ->> 'product_id', '')::uuid;
      v_variant_id := NULLIF(item ->> 'variant_id', '')::uuid;
      v_quantity := (item ->> 'quantity')::integer;
      v_fulfillment := upper(COALESCE(NULLIF(item ->> 'fulfillment_type', ''), 'IN_STOCK'));
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Malformed order item';
    END;
    IF v_product_id IS NULL OR v_quantity IS NULL OR v_quantity <= 0 OR v_quantity > 1000 THEN
      RAISE EXCEPTION 'Invalid order item values';
    END IF;
    IF v_fulfillment NOT IN ('IN_STOCK', 'PREORDER') THEN
      RAISE EXCEPTION 'Invalid fulfillment type';
    END IF;

    SELECT * INTO v_product
    FROM public.products
    WHERE id = v_product_id AND status = 'ACTIVE'
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Product is unavailable'; END IF;

    IF v_variant_id IS NOT NULL THEN
      SELECT * INTO v_variant
      FROM public.product_variants
      WHERE id = v_variant_id AND product_id = v_product_id AND status = 'ACTIVE'
      FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Selected variant is unavailable'; END IF;
      v_server_price := COALESCE(v_variant.final_sell_mmk, v_variant.price, 0);
      IF v_server_price < 0 THEN RAISE EXCEPTION 'Invalid product price'; END IF;
      IF v_fulfillment = 'PREORDER' THEN
        IF NOT COALESCE(v_variant.preorder_enabled, false)
          OR COALESCE(v_variant.selling_mode, 'IN_STOCK') NOT IN ('PREORDER', 'BOTH') THEN
          RAISE EXCEPTION 'Pre-order is not available for this variant';
        END IF;
        v_available := COALESCE(v_variant.stock_in, 0)
          - COALESCE(v_variant.sold_qty, 0) - COALESCE(v_variant.reserved_qty, 0);
        IF COALESCE(v_variant.selling_mode, 'IN_STOCK') = 'BOTH' AND v_available > 0 THEN
          RAISE EXCEPTION 'In-stock units are still available for this variant';
        END IF;
      ELSE
        v_available := COALESCE(v_variant.stock_in, 0)
          - COALESCE(v_variant.sold_qty, 0) - COALESCE(v_variant.reserved_qty, 0);
        IF v_available < v_quantity THEN RAISE EXCEPTION 'Insufficient stock for selected variant'; END IF;
        UPDATE public.product_variants
        SET reserved_qty = COALESCE(reserved_qty, 0) + v_quantity, updated_at = now()
        WHERE id = v_variant_id;
      END IF;
    ELSE
      v_server_price := COALESCE(v_product.final_sell_mmk, v_product.price, 0);
      IF v_server_price < 0 THEN RAISE EXCEPTION 'Invalid product price'; END IF;
      IF v_fulfillment = 'PREORDER' THEN
        IF NOT COALESCE(v_product.preorder_enabled, false)
          OR COALESCE(v_product.selling_mode, 'IN_STOCK') NOT IN ('PREORDER', 'BOTH') THEN
          RAISE EXCEPTION 'Pre-order is not available for this product';
        END IF;
        v_available := COALESCE(v_product.stock_in, 0)
          - COALESCE(v_product.sold_qty, 0) - COALESCE(v_product.reserved_qty, 0);
        IF COALESCE(v_product.selling_mode, 'IN_STOCK') = 'BOTH' AND v_available > 0 THEN
          RAISE EXCEPTION 'In-stock units are still available for this product';
        END IF;
      ELSE
        v_available := COALESCE(v_product.stock_in, 0)
          - COALESCE(v_product.sold_qty, 0) - COALESCE(v_product.reserved_qty, 0);
        IF v_available < v_quantity THEN RAISE EXCEPTION 'Insufficient stock for %', v_product.name; END IF;
        UPDATE public.products
        SET reserved_qty = COALESCE(reserved_qty, 0) + v_quantity, updated_at = now()
        WHERE id = v_product_id;
      END IF;
    END IF;
    v_original_price := v_server_price;
    v_sale_discount := 0;
    v_sale_campaign_id := NULL;
    SELECT campaign_id, original_price, sale_price, discount_amount
    INTO v_sale_campaign_id, v_original_price, v_server_price, v_sale_discount
    FROM public.get_active_sale_for_item(v_product_id, v_variant_id, v_original_price);
    IF v_sale_campaign_id IS NULL THEN
      v_server_price := v_original_price;
      v_sale_discount := 0;
    END IF;
    v_subtotal := v_subtotal + (v_original_price * v_quantity);
    v_sale_discount_total := v_sale_discount_total + (v_sale_discount * v_quantity);
  END LOOP;

  v_total := v_subtotal - v_sale_discount_total - v_discount + v_extra_fee;
  IF v_total < 0 THEN RAISE EXCEPTION 'Invalid order total'; END IF;

  INSERT INTO public.orders (
    user_id, customer_name, customer_phone, delivery_note, subtotal, discount,
    extra_fee, total, points_redeemed, points_value, status, payment_status,
    guest_payment_capability_digest
  ) VALUES (
    NULL, NULLIF(btrim(p_customer_name), ''), NULLIF(btrim(p_customer_phone), ''),
    p_delivery_note, v_subtotal, v_discount + v_sale_discount_total, v_extra_fee, v_total, 0, 0,
    'pending', 'unpaid', v_digest
  ) RETURNING id INTO v_order_id;

  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := NULLIF(item ->> 'product_id', '')::uuid;
    v_variant_id := NULLIF(item ->> 'variant_id', '')::uuid;
    v_quantity := (item ->> 'quantity')::integer;
    v_fulfillment := upper(COALESCE(NULLIF(item ->> 'fulfillment_type', ''), 'IN_STOCK'));

    IF v_variant_id IS NOT NULL THEN
      SELECT COALESCE(final_sell_mmk, price, 0), waiting_time,
        preorder_deposit, preorder_deposit_type
      INTO v_original_price, v_eta, v_deposit_setting, v_deposit_type
      FROM public.product_variants WHERE id = v_variant_id;
    ELSE
      SELECT COALESCE(final_sell_mmk, price, 0), waiting_time,
        preorder_deposit, preorder_deposit_type
      INTO v_original_price, v_eta, v_deposit_setting, v_deposit_type
      FROM public.products WHERE id = v_product_id;
    END IF;

    v_sale_discount := 0;
    v_sale_campaign_id := NULL;
    SELECT campaign_id, sale_price, discount_amount
    INTO v_sale_campaign_id, v_server_price, v_sale_discount
    FROM public.get_active_sale_for_item(v_product_id, v_variant_id, v_original_price);
    IF v_sale_campaign_id IS NULL THEN
      v_server_price := v_original_price;
      v_sale_discount := 0;
    END IF;
    v_deposit := CASE
      WHEN upper(COALESCE(v_deposit_type, 'FIXED')) = 'PERCENTAGE'
        THEN LEAST(v_server_price, v_server_price * LEAST(100, GREATEST(0, COALESCE(v_deposit_setting, 0))) / 100)
      ELSE LEAST(v_server_price, GREATEST(0, COALESCE(v_deposit_setting, 0)))
    END;

    INSERT INTO public.order_items (
      order_id, product_id, variant_id, product_name, unit_price, quantity, line_total,
      fulfillment_type, estimated_arrival, deposit_required,
      original_unit_price, discount_amount, sale_campaign_id
    ) VALUES (
      v_order_id, v_product_id, v_variant_id,
      btrim(COALESCE(item ->> 'product_name', 'Product')),
      v_server_price, v_quantity, v_server_price * v_quantity,
      v_fulfillment,
      CASE WHEN v_fulfillment = 'PREORDER' THEN v_eta ELSE NULL END,
      CASE WHEN v_fulfillment = 'PREORDER' THEN v_deposit ELSE 0 END,
      v_original_price, COALESCE(v_sale_discount, 0), v_sale_campaign_id
    );
  END LOOP;

  RETURN jsonb_build_object('order_id', v_order_id, 'capability', v_capability);
END;
$function$;

REVOKE ALL ON FUNCTION public.create_guest_order_with_items(text, text, text, numeric, numeric, jsonb, integer) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.create_guest_order_with_items(text, text, text, numeric, numeric, jsonb, integer) TO anon;

-- The deposit setting is per unit. Multiply by quantity when summarizing the
-- amount due, while preserving the guest capability check for guest checkout.
CREATE OR REPLACE FUNCTION public.finalize_order_payment_details(
  p_order_id uuid,
  p_payment_method_id uuid DEFAULT NULL,
  p_guest_capability text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_deposit_total numeric := 0;
  v_digest text;
BEGIN
  IF p_payment_method_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.payment_methods WHERE id = p_payment_method_id AND is_active
  ) THEN
    RAISE EXCEPTION 'Selected payment method is unavailable';
  END IF;

  IF v_uid IS NULL THEN
    IF p_guest_capability IS NULL OR length(p_guest_capability) < 32 THEN
      RAISE EXCEPTION 'Order not found';
    END IF;
    SELECT guest_payment_capability_digest INTO v_digest
    FROM public.orders
    WHERE id = p_order_id
      AND user_id IS NULL
      AND status = 'pending'
      AND payment_status IN ('unpaid', 'partial')
      AND guest_payment_capability_digest IS NOT NULL;
    IF NOT FOUND OR NOT extensions.digest(p_guest_capability, 'sha256') = decode(v_digest, 'hex') THEN
      RAISE EXCEPTION 'Order not found';
    END IF;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM public.orders
      WHERE id = p_order_id AND user_id = v_uid
        AND status = 'pending' AND payment_status IN ('unpaid', 'partial')
    ) THEN
      RAISE EXCEPTION 'Order not found';
    END IF;
  END IF;

  SELECT COALESCE(SUM(deposit_required * quantity), 0)
  INTO v_deposit_total
  FROM public.order_items
  WHERE order_id = p_order_id;

  UPDATE public.orders
  SET payment_method_id = p_payment_method_id,
      deposit_total = v_deposit_total,
      deposit_status = CASE WHEN v_deposit_total > 0 THEN 'unpaid' ELSE 'paid' END,
      updated_at = now()
  WHERE id = p_order_id
    AND status = 'pending'
    AND payment_status IN ('unpaid', 'partial');
END;
$function$;

REVOKE ALL ON FUNCTION public.finalize_order_payment_details(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_order_payment_details(uuid, uuid, text) TO anon, authenticated;
