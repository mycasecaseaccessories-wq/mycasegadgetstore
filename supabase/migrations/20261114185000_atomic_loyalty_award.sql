-- Award loyalty points atomically from the server-trusted order total.
-- The order row lock plus the existing earn-transaction check makes retries
-- idempotent and prevents clients from choosing the amount or target phone.

CREATE OR REPLACE FUNCTION public.award_order_loyalty_points(
  p_order_id uuid,
  p_user_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
  v_settings jsonb;
  v_enabled boolean;
  v_earn_per_amount numeric;
  v_phone text;
  v_points integer;
BEGIN
  IF p_order_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  SELECT id, user_id, customer_phone, total, status
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.status = 'cancelled' THEN
    RETURN 0;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.loyalty_transactions
    WHERE order_id = p_order_id AND kind = 'earn'
  ) THEN
    RETURN 0;
  END IF;

  SELECT to_jsonb(s)
  INTO v_settings
  FROM public.settings s
  ORDER BY s.updated_at DESC
  LIMIT 1;

  -- to_jsonb keeps this compatible with installations that do not yet have
  -- optional loyalty configuration columns.
  v_enabled := COALESCE(NULLIF(v_settings ->> 'loyalty_enabled', '')::boolean, true);
  v_earn_per_amount := COALESCE(NULLIF(v_settings ->> 'loyalty_earn_per_amount', '')::numeric, 1000);

  IF NOT v_enabled OR v_earn_per_amount <= 0 THEN
    RETURN 0;
  END IF;

  v_phone := NULLIF(btrim(COALESCE(v_order.customer_phone, '')), '');
  IF v_phone IS NULL THEN
    RETURN 0;
  END IF;

  v_points := floor(GREATEST(COALESCE(v_order.total, 0), 0) / v_earn_per_amount)::integer;
  IF v_points <= 0 THEN
    RETURN 0;
  END IF;

  INSERT INTO public.loyalty_balances (customer_key, customer_phone, points, updated_at)
  VALUES (v_phone, v_phone, v_points, now())
  ON CONFLICT (customer_key)
  DO UPDATE SET
    points = public.loyalty_balances.points + EXCLUDED.points,
    customer_phone = EXCLUDED.customer_phone,
    updated_at = now();

  INSERT INTO public.loyalty_transactions (customer_key, order_id, kind, delta, value, note)
  VALUES (v_phone, p_order_id, 'earn', v_points, 0, 'Earned from checkout');

  UPDATE public.orders
  SET points_earned = v_points, updated_at = now()
  WHERE id = p_order_id;

  RETURN v_points;
END;
$$;

REVOKE ALL ON FUNCTION public.award_order_loyalty_points(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_order_loyalty_points(uuid, uuid)
  TO service_role;
