
-- Make buckets private
UPDATE storage.buckets SET public = false WHERE id IN ('product-images', 'branding');

-- Drop existing permissive policies
DROP POLICY IF EXISTS "public read branding" ON storage.objects;
DROP POLICY IF EXISTS "public read product-images" ON storage.objects;
DROP POLICY IF EXISTS "auth write branding" ON storage.objects;
DROP POLICY IF EXISTS "auth write product-images" ON storage.objects;
DROP POLICY IF EXISTS "auth update branding" ON storage.objects;
DROP POLICY IF EXISTS "auth update product-images" ON storage.objects;
DROP POLICY IF EXISTS "auth delete branding" ON storage.objects;
DROP POLICY IF EXISTS "auth delete product-images" ON storage.objects;

-- Authenticated-only read
CREATE POLICY "authenticated read branding" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'branding');
CREATE POLICY "authenticated read product-images" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'product-images');

-- Authenticated write (insert/update/delete) — restricted to admin/staff
CREATE POLICY "staff write branding" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'branding' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')));
CREATE POLICY "staff update branding" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'branding' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')))
  WITH CHECK (bucket_id = 'branding' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')));
CREATE POLICY "admin delete branding" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'branding' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "staff write product-images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')));
CREATE POLICY "staff update product-images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')))
  WITH CHECK (bucket_id = 'product-images' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')));
CREATE POLICY "admin delete product-images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));
