
-- Rates table
CREATE TABLE public.rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL DEFAULT CURRENT_DATE,
  source text NOT NULL DEFAULT 'THB',
  buy_rate numeric NOT NULL DEFAULT 0,
  sell_gap numeric NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all rates" ON public.rates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_rates_date ON public.rates(date DESC);

-- Product variants
CREATE TABLE public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_code text,
  name text NOT NULL,
  size text,
  color text,
  price numeric NOT NULL DEFAULT 0,
  thb_price numeric,
  final_sell_mmk numeric,
  stock_in integer NOT NULL DEFAULT 0,
  sold_qty integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ACTIVE',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all product_variants" ON public.product_variants FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_variants_product ON public.product_variants(product_id);
CREATE TRIGGER variants_updated_at BEFORE UPDATE ON public.product_variants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Vouchers
CREATE SEQUENCE IF NOT EXISTS vouchers_voucher_no_seq START 1001;
CREATE TABLE public.vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_no integer NOT NULL DEFAULT nextval('vouchers_voucher_no_seq'),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  customer_name text,
  customer_phone text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  extra_fee numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  paid numeric NOT NULL DEFAULT 0,
  payment_method text,
  note text,
  issued_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all vouchers" ON public.vouchers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_vouchers_no ON public.vouchers(voucher_no DESC);

-- Pricing/inventory fields on products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_code text,
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS stock_in integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sold_qty integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS thb_price numeric,
  ADD COLUMN IF NOT EXISTS final_sell_mmk numeric,
  ADD COLUMN IF NOT EXISTS margin_percent numeric,
  ADD COLUMN IF NOT EXISTS pricing_buy_rate numeric,
  ADD COLUMN IF NOT EXISTS pricing_sell_gap numeric,
  ADD COLUMN IF NOT EXISTS pricing_cargo_mmk numeric,
  ADD COLUMN IF NOT EXISTS pricing_deli_mmk numeric,
  ADD COLUMN IF NOT EXISTS pricing_other_mmk numeric,
  ADD COLUMN IF NOT EXISTS pricing_profit_mode text,
  ADD COLUMN IF NOT EXISTS pricing_fixed_profit numeric,
  ADD COLUMN IF NOT EXISTS pricing_percent_profit numeric,
  ADD COLUMN IF NOT EXISTS pricing_rounding_rule text,
  ADD COLUMN IF NOT EXISTS pricing_minimum_price_mode text;

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS minimum_price_buffer numeric DEFAULT 0;
