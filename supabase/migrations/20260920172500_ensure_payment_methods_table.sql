-- Ensure manual payment methods exist before order deposit metadata references them.
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  account_name text NOT NULL,
  account_number text NOT NULL,
  bank_name text,
  note text,
  qr_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff manage payment_methods" ON public.payment_methods;
CREATE POLICY "staff manage payment_methods" ON public.payment_methods
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'staff'::app_role));

DROP POLICY IF EXISTS "public read active payment_methods" ON public.payment_methods;
CREATE POLICY "public read active payment_methods" ON public.payment_methods
  FOR SELECT TO anon, authenticated USING (is_active = true);
