-- Loyalty redemption is intentionally unavailable until the phone identity
-- and payment-state checks are implemented end-to-end. Reject redemption at the
-- database boundary as well as hiding it in the storefront.
CREATE OR REPLACE FUNCTION public.reject_loyalty_redemption()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.kind = 'redeem' THEN
    RAISE EXCEPTION 'Loyalty redemption is temporarily unavailable';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.reject_loyalty_redemption()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_reject_loyalty_redemption
  ON public.loyalty_transactions;
CREATE TRIGGER trg_reject_loyalty_redemption
  BEFORE INSERT ON public.loyalty_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_loyalty_redemption();
