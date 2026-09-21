-- Rich catalog content for customer-facing product detail pages.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS highlights text,
  ADD COLUMN IF NOT EXISTS specifications text,
  ADD COLUMN IF NOT EXISTS warranty_info text,
  ADD COLUMN IF NOT EXISTS shipping_info text;

GRANT SELECT (
  id, name, size, price, image_url, brand, category, waiting_time,
  stock_status, stock_in, sold_qty, final_sell_mmk, product_code, status,
  selling_mode, availability, preorder_enabled, preorder_deposit,
  preorder_deposit_type, description, highlights, specifications,
  warranty_info, shipping_info
) ON public.products TO anon;
