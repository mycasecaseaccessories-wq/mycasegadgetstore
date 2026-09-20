-- Store manual payment selection and pre-order deposit state on each order.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method_id uuid REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deposit_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_paid numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_status text NOT NULL DEFAULT 'unpaid';

ALTER TABLE public.orders
  ADD CONSTRAINT orders_deposit_status_allowed
    CHECK (deposit_status IN ('unpaid', 'partial', 'paid')),
  ADD CONSTRAINT orders_deposit_amounts_valid
    CHECK (deposit_total >= 0 AND deposit_paid >= 0 AND deposit_paid <= deposit_total);

CREATE OR REPLACE FUNCTION public.finalize_order_payment_details(
  p_order_id uuid,
  p_payment_method_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_deposit_total numeric := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_payment_method_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.payment_methods WHERE id = p_payment_method_id AND is_active
  ) THEN
    RAISE EXCEPTION 'Selected payment method is unavailable';
  END IF;
  SELECT COALESCE(SUM(deposit_required), 0)
    INTO v_deposit_total
    FROM public.order_items
    WHERE order_id = p_order_id;

  UPDATE public.orders
  SET payment_method_id = p_payment_method_id,
      deposit_total = v_deposit_total,
      deposit_status = CASE WHEN v_deposit_total > 0 THEN 'unpaid' ELSE 'paid' END,
      updated_at = now()
  WHERE id = p_order_id
    AND user_id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_order_payment_details(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_order_payment_details(uuid, uuid) TO authenticated;
