-- Capability-protected guest order tracking.
-- This SECURITY DEFINER RPC exposes only the minimum order summary after
-- verifying the SHA-256 digest of the 256-bit checkout capability.
CREATE OR REPLACE FUNCTION public.get_guest_order_status(
  p_order_id uuid,
  p_guest_capability text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_order jsonb;
BEGIN
  IF p_guest_capability IS NULL
    OR length(p_guest_capability) < 32
    OR length(p_guest_capability) > 256 THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  SELECT jsonb_build_object(
    'id', o.id,
    'order_no', o.order_no,
    'status', o.status,
    'payment_status', o.payment_status,
    'total', o.total,
    'created_at', o.created_at,
    'items', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', oi.id,
          'product_name', oi.product_name,
          'quantity', oi.quantity,
          'line_total', oi.line_total,
          'fulfillment_type', oi.fulfillment_type,
          'estimated_arrival', oi.estimated_arrival,
          'deposit_required', oi.deposit_required
        ) ORDER BY oi.id
      )
      FROM public.order_items oi
      WHERE oi.order_id = o.id
    ), '[]'::jsonb)
  )
  INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id
    AND o.user_id IS NULL
    AND o.guest_payment_capability_digest IS NOT NULL
    AND extensions.digest(p_guest_capability, 'sha256') = decode(o.guest_payment_capability_digest, 'hex')
  LIMIT 1;

  IF v_order IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  RETURN v_order;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_guest_order_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_guest_order_status(uuid, text) TO anon, authenticated;
COMMENT ON FUNCTION public.get_guest_order_status(uuid, text) IS
  'Returns minimal guest order status only when the unguessable checkout capability matches the stored SHA-256 digest.';
