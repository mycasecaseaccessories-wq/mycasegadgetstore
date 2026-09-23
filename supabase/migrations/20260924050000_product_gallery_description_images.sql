-- Rich product media: multiple gallery images plus images embedded in description.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS gallery_images text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS description_images text[] NOT NULL DEFAULT '{}';

GRANT SELECT (
  id, name, image_url, gallery_images, description_images, description,
  highlights, specifications, warranty_info, shipping_info, brand, category,
  size, price, waiting_time, stock_status, stock_in, sold_qty, final_sell_mmk,
  product_code, status, selling_mode, availability, preorder_enabled,
  preorder_deposit, preorder_deposit_type
) ON public.products TO anon;
