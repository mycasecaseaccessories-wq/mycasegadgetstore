-- Store fulfillment at order-item level and reserve physical stock atomically.
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS fulfillment_type text NOT NULL DEFAULT 'IN_STOCK',
  ADD COLUMN IF NOT EXISTS estimated_arrival text,
  ADD COLUMN IF NOT EXISTS deposit_required numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_paid numeric NOT NULL DEFAULT 0;

ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_fulfillment_type_allowed
    CHECK (fulfillment_type IN ('IN_STOCK', 'PREORDER')),
  ADD CONSTRAINT order_items_deposit_valid
    CHECK (deposit_required >= 0 AND deposit_paid >= 0 AND deposit_paid <= deposit_required);

-- Expose only catalog fields needed by the public storefront.
GRANT SELECT (
  id, name, size, price, image_url, brand, category, waiting_time,
  stock_status, stock_in, sold_qty, final_sell_mmk, product_code, status, created_at,
  selling_mode, availability, preorder_enabled, preorder_deposit, preorder_deposit_type
) ON public.products TO anon;

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
  v_total numeric;
  v_product record;
  v_product_id uuid;
  v_unit_price numeric;
  v_quantity integer;
  v_line_total numeric;
  v_server_price numeric;
  v_available integer;
  v_fulfillment text;
  v_deposit numeric;
  v_eta text;
  item jsonb;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one order item is required';
  END IF;
  IF v_discount < 0 OR v_extra_fee < 0 THEN RAISE EXCEPTION 'Invalid discount or extra fee'; END IF;

  -- Lock every product row while validating and reserving the order.
  FOR item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    BEGIN
      v_product_id := NULLIF(item ->> 'product_id', '')::uuid;
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

    v_server_price := COALESCE(v_product.final_sell_mmk, v_product.price, 0);
    IF v_server_price < 0 THEN RAISE EXCEPTION 'Invalid product price'; END IF;

    IF v_fulfillment = 'PREORDER' THEN
      IF NOT COALESCE(v_product.preorder_enabled, false)
         OR v_product.selling_mode NOT IN ('PREORDER', 'BOTH') THEN
        RAISE EXCEPTION 'Pre-order is not available for this product';
      END IF;
      v_deposit := CASE
        WHEN v_product.preorder_deposit_type = 'PERCENTAGE'
          THEN LEAST(v_server_price, v_server_price * LEAST(100, GREATEST(0, v_product.preorder_deposit)) / 100)
        ELSE LEAST(v_server_price, GREATEST(0, v_product.preorder_deposit))
      END;
    ELSE
      v_available := COALESCE(v_product.stock_in, 0) - COALESCE(v_product.sold_qty, 0) - COALESCE(v_product.reserved_qty, 0);
      IF v_available < v_quantity THEN RAISE EXCEPTION 'Insufficient stock for %', v_product.name; END IF;
      UPDATE public.products
        SET reserved_qty = COALESCE(reserved_qty, 0) + v_quantity,
            updated_at = now()
        WHERE id = v_product_id;
      v_deposit := 0;
    END IF;

    v_subtotal := v_subtotal + (v_server_price * v_quantity);
  END LOOP;

  v_total := v_subtotal - v_discount + v_extra_fee;
  IF v_total < 0 THEN RAISE EXCEPTION 'Invalid order total'; END IF;

  INSERT INTO public.orders (
    user_id, customer_name, customer_phone, delivery_note,
    subtotal, discount, extra_fee, total, status, payment_status
  ) VALUES (
    v_user_id, NULLIF(btrim(p_customer_name), ''), NULLIF(btrim(p_customer_phone), ''), p_delivery_note,
    v_subtotal, v_discount, v_extra_fee, v_total, 'pending', 'unpaid'
  ) RETURNING id INTO v_order_id;

  FOR item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := NULLIF(item ->> 'product_id', '')::uuid;
    v_quantity := (item ->> 'quantity')::integer;
    v_fulfillment := upper(COALESCE(NULLIF(item ->> 'fulfillment_type', ''), 'IN_STOCK'));
    SELECT COALESCE(final_sell_mmk, price, 0), waiting_time,
      CASE WHEN preorder_deposit_type = 'PERCENTAGE'
        THEN LEAST(COALESCE(final_sell_mmk, price, 0), COALESCE(final_sell_mmk, price, 0) * LEAST(100, GREATEST(0, preorder_deposit)) / 100)
        ELSE LEAST(COALESCE(final_sell_mmk, price, 0), GREATEST(0, preorder_deposit)) END
      INTO v_server_price, v_eta, v_deposit
      FROM public.products WHERE id = v_product_id;
    v_line_total := v_server_price * v_quantity;
    INSERT INTO public.order_items (
      order_id, product_id, product_name, unit_price, quantity, line_total,
      fulfillment_type, estimated_arrival, deposit_required
    ) VALUES (
      v_order_id, v_product_id, btrim(COALESCE(item ->> 'product_name', 'Product')),
      v_server_price, v_quantity, v_line_total,
      v_fulfillment, CASE WHEN v_fulfillment = 'PREORDER' THEN v_eta ELSE NULL END,
      CASE WHEN v_fulfillment = 'PREORDER' THEN v_deposit ELSE 0 END
    );
  END LOOP;

  RETURN v_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_order_with_items(text, text, text, numeric, numeric, jsonb, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_order_with_items(text, text, text, numeric, numeric, jsonb, integer) TO authenticated;
