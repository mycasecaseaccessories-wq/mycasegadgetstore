-- Loyalty: persistent customer balances + transactions; orders points fields
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS points_earned integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points_redeemed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points_value numeric NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.loyalty_balances (
  customer_key text PRIMARY KEY,
  points integer NOT NULL DEFAULT 0,
  customer_id uuid,
  customer_name text,
  customer_phone text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.loyalty_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth all loyalty_balances"
  ON public.loyalty_balances FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_loyalty_balances_updated_at
  BEFORE UPDATE ON public.loyalty_balances
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_key text NOT NULL,
  order_id uuid,
  kind text NOT NULL CHECK (kind IN ('earn','redeem','adjust')),
  delta integer NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth all loyalty_transactions"
  ON public.loyalty_transactions FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_loyalty_tx_customer ON public.loyalty_transactions(customer_key);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_order ON public.loyalty_transactions(order_id);