-- Auto-expire unpaid pending orders so physical stock is not reserved forever.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS reservation_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS reservation_released_at timestamptz;

UPDATE public.orders
SET reservation_expires_at = COALESCE(reservation_expires_at, created_at + interval '24 hours')
WHERE reservation_expires_at IS NULL;

ALTER TABLE public.orders
  ALTER COLUMN reservation_expires_at SET DEFAULT (now() + interval '24 hours');

CREATE INDEX IF NOT EXISTS idx_orders_pending_reservation_expiry
  ON public.orders (reservation_expires_at)
  WHERE status = 'pending' AND payment_status <> 'paid';

CREATE OR REPLACE FUNCTION public.expire_pending_order_reservations(
  p_limit integer DEFAULT 100
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order_id uuid;
  v_count integer := 0;
BEGIN
  IF v_uid IS NOT NULL
     AND NOT (private.has_role(v_uid, 'admin'::app_role) OR private.has_role(v_uid, 'staff'::app_role)) THEN
    RAISE EXCEPTION 'Admin or staff permission required';
  END IF;
  IF p_limit < 1 OR p_limit > 1000 THEN RAISE EXCEPTION 'Invalid expiry batch size'; END IF;

  FOR v_order_id IN
    SELECT id
    FROM public.orders
    WHERE status = 'pending'
      AND payment_status IN ('unpaid', 'partial')
      AND reservation_expires_at IS NOT NULL
      AND reservation_expires_at <= now()
    ORDER BY reservation_expires_at
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  LOOP
    UPDATE public.orders
    SET status = 'cancelled',
        reservation_released_at = now(),
        updated_at = now()
    WHERE id = v_order_id
      AND status = 'pending';
    IF FOUND THEN v_count := v_count + 1; END IF;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_pending_order_reservations(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expire_pending_order_reservations(integer) TO authenticated;
