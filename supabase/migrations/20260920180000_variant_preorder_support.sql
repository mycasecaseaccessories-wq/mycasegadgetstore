-- Allow each product variant to have its own stock and pre-order policy.
ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS selling_mode text NOT NULL DEFAULT 'IN_STOCK',
  ADD COLUMN IF NOT EXISTS preorder_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS preorder_deposit numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS preorder_deposit_type text NOT NULL DEFAULT 'FIXED',
  ADD COLUMN IF NOT EXISTS waiting_time text,
  ADD COLUMN IF NOT EXISTS reserved_qty integer NOT NULL DEFAULT 0;

ALTER TABLE public.product_variants
  ADD CONSTRAINT product_variants_selling_mode_allowed
    CHECK (selling_mode IN ('IN_STOCK', 'PREORDER', 'BOTH')),
  ADD CONSTRAINT product_variants_deposit_type_allowed
    CHECK (preorder_deposit_type IN ('FIXED', 'PERCENTAGE')),
  ADD CONSTRAINT product_variants_preorder_deposit_valid
    CHECK (preorder_deposit >= 0 AND (preorder_deposit_type <> 'PERCENTAGE' OR preorder_deposit <= 100)),
  ADD CONSTRAINT product_variants_reserved_valid
    CHECK (reserved_qty >= 0);

GRANT SELECT (
  id, product_id, variant_code, name, size, color, price, final_sell_mmk,
  stock_in, sold_qty, status, selling_mode, preorder_enabled, preorder_deposit,
  preorder_deposit_type, waiting_time, reserved_qty
) ON public.product_variants TO anon;
