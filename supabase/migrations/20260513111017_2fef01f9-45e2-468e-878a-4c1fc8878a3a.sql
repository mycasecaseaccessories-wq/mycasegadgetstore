
-- Drop existing permissive policies
DROP POLICY IF EXISTS "auth all loyalty_balances" ON public.loyalty_balances;
DROP POLICY IF EXISTS "auth all loyalty_transactions" ON public.loyalty_transactions;

-- loyalty_balances: authenticated-only, explicit per-command
CREATE POLICY "loyalty_balances select auth"
  ON public.loyalty_balances FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "loyalty_balances insert auth"
  ON public.loyalty_balances FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "loyalty_balances update auth"
  ON public.loyalty_balances FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "loyalty_balances delete admin"
  ON public.loyalty_balances FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- loyalty_transactions: append-only audit log
CREATE POLICY "loyalty_transactions select auth"
  ON public.loyalty_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "loyalty_transactions insert auth"
  ON public.loyalty_transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- No UPDATE policy: rows are immutable
CREATE POLICY "loyalty_transactions delete admin"
  ON public.loyalty_transactions FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
