-- Storefront product/branding images must be readable by anonymous visitors.
UPDATE storage.buckets
SET public = true
WHERE id IN ('product-images', 'branding');

DROP POLICY IF EXISTS "public read product-images" ON storage.objects;
CREATE POLICY "public read product-images"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "public read branding" ON storage.objects;
CREATE POLICY "public read branding"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'branding');
