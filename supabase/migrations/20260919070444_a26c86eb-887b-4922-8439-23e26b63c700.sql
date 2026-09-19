CREATE OR REPLACE FUNCTION public.create_order_with_items(
  p_customer_name text,
  p_customer_phone text,
  p_delivery_note text,
  p_discount numeric,
  p_extra_fee numeric,
  p_redeem_points integer,
  p_items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_staff boolean;
  v_order_id uuid;
  v_subtotal numeric := 0;
  v_discount numeric := GREATEST(COALESCE(p_discount, 0), 0);
  v_extra numeric := GREATEST(COALESCE(p_extra_fee, 0), 0);
  v_redeem integer := GREATEST(COALESCE(p_redeem_points, 0), 0);
  v_enabled boolean := false;
  v_min_redeem integer := 0;
  v_redeem_value numeric := 0;
  v_points_value numeric := 0;
  v_key text;
  v_balance integer := 0;
  v_total numeric;
  v_item jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Order must contain at least one item';
  END IF;

  v_is_staff := private.has_role(v_uid, 'admin'::public.app_role)
             OR private.has_role(v_uid, 'staff'::public.app_role);

  -- validate items and compute subtotal server-side
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF COALESCE((v_item->>'quantity')::numeric, 0) <= 0
       OR COALESCE((v_item->>'unit_price')::numeric, -1) < 0 THEN
      RAISE EXCEPTION 'Invalid item quantity or price';
    END IF;
    v_subtotal := v_subtotal + (v_item->>'unit_price')::numeric * (v_item->>'quantity')::numeric;
  END LOOP;

  SELECT COALESCE(loyalty_enabled, false),
         COALESCE(loyalty_min_redeem, 0),
         COALESCE(loyalty_redeem_value, 0)
    INTO v_enabled, v_min_redeem, v_redeem_value
    FROM public.settings
   LIMIT 1;

  v_key := NULLIF(trim(COALESCE(p_customer_phone, '')), '');

  IF v_redeem > 0 AND v_enabled AND v_redeem_value > 0 AND v_key IS NOT NULL THEN
    SELECT COALESCE(points, 0) INTO v_balance
      FROM public.loyalty_balances WHERE customer_key = v_key;
    v_redeem := LEAST(v_redeem, COALESCE(v_balance, 0));
    IF v_redeem < v_min_redeem THEN
      v_redeem := 0;
    END IF;
    v_points_value := LEAST(v_redeem * v_redeem_value, v_subtotal);
    v_redeem := CASE WHEN v_redeem_value > 0 THEN FLOOR(v_points_value / v_redeem_value)::int ELSE 0 END;
    v_points_value := v_redeem * v_redeem_value;
  ELSE
    v_redeem := 0;
    v_points_value := 0;
  END IF;

  v_total := GREATEST(v_subtotal - v_discount - v_points_value + v_extra, 0);

  INSERT INTO public.orders (
    customer_name, customer_phone, delivery_note,
    discount, extra_fee, subtotal, total,
    points_redeemed, points_value, user_id
  ) VALUES (
    NULLIF(trim(COALESCE(p_customer_name, '')), ''), v_key, NULLIF(trim(COALESCE(p_delivery_note, '')), ''),
    v_discount, v_extra, v_subtotal, v_total,
    v_redeem, v_points_value,
    CASE WHEN v_is_staff THEN NULL ELSE v_uid END
  )
  RETURNING id INTO v_order_id;

  INSERT INTO public.order_items (order_id, product_id, product_name, unit_price, quantity, line_total)
  SELECT v_order_id,
         NULLIF(item->>'product_id', '')::uuid,
         COALESCE(item->>'product_name', 'Item'),
         (item->>'unit_price')::numeric,
         (item->>'quantity')::numeric,
         (item->>'unit_price')::numeric * (item->>'quantity')::numeric
    FROM jsonb_array_elements(p_items) AS item;

  IF v_redeem > 0 THEN
    UPDATE public.loyalty_balances
       SET points = GREATEST(points - v_redeem, 0), updated_at = now()
     WHERE customer_key = v_key;

    INSERT INTO public.loyalty_transactions (customer_key, delta, kind, value, order_id, note)
    VALUES (v_key, -v_redeem, 'redeem', v_points_value, v_order_id, 'Redeemed at checkout');
  END IF;

  RETURN v_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_order_with_items(text, text, text, numeric, numeric, integer, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order_with_items(text, text, text, numeric, numeric, integer, jsonb) TO authenticated;