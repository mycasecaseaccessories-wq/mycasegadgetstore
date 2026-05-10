-- Buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('branding', 'branding', true) ON CONFLICT (id) DO NOTHING;

-- Storage policies (drop existing variants first to avoid duplicates)
DROP POLICY IF EXISTS "public read product-images" ON storage.objects;
DROP POLICY IF EXISTS "auth write product-images" ON storage.objects;
DROP POLICY IF EXISTS "auth update product-images" ON storage.objects;
DROP POLICY IF EXISTS "auth delete product-images" ON storage.objects;
DROP POLICY IF EXISTS "public read branding" ON storage.objects;
DROP POLICY IF EXISTS "auth write branding" ON storage.objects;
DROP POLICY IF EXISTS "auth update branding" ON storage.objects;
DROP POLICY IF EXISTS "auth delete branding" ON storage.objects;

CREATE POLICY "public read product-images" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
CREATE POLICY "auth write product-images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images');
CREATE POLICY "auth update product-images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'product-images');
CREATE POLICY "auth delete product-images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'product-images');

CREATE POLICY "public read branding" ON storage.objects FOR SELECT USING (bucket_id = 'branding');
CREATE POLICY "auth write branding" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'branding');
CREATE POLICY "auth update branding" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'branding');
CREATE POLICY "auth delete branding" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'branding');

-- Columns
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS low_stock_threshold integer NOT NULL DEFAULT 5;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en';