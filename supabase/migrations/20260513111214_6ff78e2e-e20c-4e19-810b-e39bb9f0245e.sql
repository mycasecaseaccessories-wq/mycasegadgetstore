
-- Helper: verify a customer_key matches an existing customer (by id or phone)
CREATE OR REPLACE FUNCTION public.loyalty_key_matches_customer(_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.customers
    WHERE _key IS NOT NULL
      AND length(btrim(_key)) > 0
      AND (id::text = _key OR phone = _key)
  )
$$;

-- Replace loyalty_balances policies
DROP POLICY IF EXISTS "loyalty_balances select auth" ON public.loyalty_balances;
DROP POLICY IF EXISTS "loyalty_balances insert auth" ON public.loyalty_balances;
DROP POLICY IF EXISTS "loyalty_balances update auth" ON public.loyalty_balances;
DROP POLICY IF EXISTS "loyalty_balances delete admin" ON public.loyalty_balances;

CREATE POLICY "loyalty_balances select staff"
  ON public.loyalty_balances FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'staff'::public.app_role)
  );

CREATE POLICY "loyalty_balances insert staff"
  ON public.loyalty_balances FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'staff'::public.app_role)
    )
    AND public.loyalty_key_matches_customer(customer_key)
  );

CREATE POLICY "loyalty_balances update staff"
  ON public.loyalty_balances FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'staff'::public.app_role)
  )
  WITH CHECK (
    public.loyalty_key_matches_customer(customer_key)
  );

CREATE POLICY "loyalty_balances delete admin"
  ON public.loyalty_balances FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Replace loyalty_transactions policies
DROP POLICY IF EXISTS "loyalty_transactions select auth" ON public.loyalty_transactions;
DROP POLICY IF EXISTS "loyalty_transactions insert auth" ON public.loyalty_transactions;
DROP POLICY IF EXISTS "loyalty_transactions delete admin" ON public.loyalty_transactions;

CREATE POLICY "loyalty_transactions select staff"
  ON public.loyalty_transactions FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'staff'::public.app_role)
  );

CREATE POLICY "loyalty_transactions insert staff"
  ON public.loyalty_transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'staff'::public.app_role)
    )
    AND public.loyalty_key_matches_customer(customer_key)
    AND kind IN ('earn','redeem','adjust')
  );

-- No UPDATE policy: append-only audit log

CREATE POLICY "loyalty_transactions delete admin"
  ON public.loyalty_transactions FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
