-- Additive product selling model for in-stock, preorder, and mixed catalog items.
-- Existing stock/status columns remain intact for backward compatibility.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS selling_mode text NOT NULL DEFAULT 'IN_STOCK',
  ADD COLUMN IF NOT EXISTS availability text NOT NULL DEFAULT 'AVAILABLE',
  ADD COLUMN IF NOT EXISTS preorder_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS preorder_deposit numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS preorder_deposit_type text NOT NULL DEFAULT 'FIXED',
  ADD COLUMN IF NOT EXISTS reserved_qty integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT true;

UPDATE public.products
SET selling_mode = CASE
  WHEN COALESCE(preorder_enabled, false) THEN
    CASE WHEN COALESCE(stock_in, 0) - COALESCE(sold_qty, 0) > 0 THEN 'BOTH' ELSE 'PREORDER' END
  ELSE 'IN_STOCK'
END
WHERE selling_mode IS NULL OR selling_mode = '';

UPDATE public.products
SET availability = CASE
  WHEN COALESCE(status, 'ACTIVE') = 'ACTIVE'
    AND COALESCE(stock_in, 0) - COALESCE(sold_qty, 0) > 0 THEN 'AVAILABLE'
  WHEN COALESCE(status, 'ACTIVE') = 'ACTIVE' THEN 'OUT_OF_STOCK'
  ELSE 'DISCONTINUED'
END
WHERE availability IS NULL OR availability = '';

UPDATE public.products
SET published = (COALESCE(status, 'ACTIVE') = 'ACTIVE')
WHERE published IS NULL;

ALTER TABLE public.products
  ADD CONSTRAINT products_selling_mode_allowed
    CHECK (selling_mode IN ('IN_STOCK', 'PREORDER', 'BOTH')),
  ADD CONSTRAINT products_availability_allowed
    CHECK (availability IN ('AVAILABLE', 'COMING_SOON', 'OUT_OF_STOCK', 'DISCONTINUED')),
  ADD CONSTRAINT products_deposit_type_allowed
    CHECK (preorder_deposit_type IN ('FIXED', 'PERCENTAGE')),
  ADD CONSTRAINT products_preorder_deposit_valid
    CHECK (preorder_deposit >= 0 AND (preorder_deposit_type <> 'PERCENTAGE' OR preorder_deposit <= 100)),
  ADD CONSTRAINT products_reserved_nonnegative
    CHECK (reserved_qty >= 0);
