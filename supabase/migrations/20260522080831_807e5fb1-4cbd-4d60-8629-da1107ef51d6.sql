DROP POLICY IF EXISTS "staff read vouchers" ON public.vouchers;
DROP POLICY IF EXISTS "admin read vouchers" ON public.vouchers;

CREATE POLICY "admin read vouchers"
ON public.vouchers
FOR SELECT
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role));