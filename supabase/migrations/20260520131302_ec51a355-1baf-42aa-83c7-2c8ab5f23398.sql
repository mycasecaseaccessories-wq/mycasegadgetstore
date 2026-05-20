
-- Unique voucher numbers
ALTER TABLE public.vouchers
  ADD CONSTRAINT vouchers_voucher_no_unique UNIQUE (voucher_no);

-- Replace staff-manage policy with admin-only mutations, staff read
DROP POLICY IF EXISTS "staff manage vouchers" ON public.vouchers;

CREATE POLICY "staff read vouchers"
  ON public.vouchers FOR SELECT
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "admin insert vouchers"
  ON public.vouchers FOR INSERT
  TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin update vouchers"
  ON public.vouchers FOR UPDATE
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin delete vouchers"
  ON public.vouchers FOR DELETE
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));
