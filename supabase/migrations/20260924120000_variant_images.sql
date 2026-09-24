ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS image_url text;

COMMENT ON COLUMN public.product_variants.image_url IS
  'Primary image for this color/model variant, used by the storefront selector.';
