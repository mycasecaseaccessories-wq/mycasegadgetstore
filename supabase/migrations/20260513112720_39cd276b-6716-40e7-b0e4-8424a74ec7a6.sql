
-- 1. Private schema
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated;

-- 2. Recreate helpers in private schema
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION private.loyalty_key_matches_customer(_key text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.customers
    WHERE _key IS NOT NULL AND length(btrim(_key)) > 0
      AND (id::text = _key OR phone = _key)
  )
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM public, anon;
REVOKE ALL ON FUNCTION private.loyalty_key_matches_customer(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION private.loyalty_key_matches_customer(text) TO authenticated;

-- 3. Recreate all policies referencing the helpers

-- user_roles
DROP POLICY IF EXISTS "users read own roles" ON public.user_roles;
DROP POLICY IF EXISTS "admins manage roles" ON public.user_roles;
CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

-- activity_logs
DROP POLICY IF EXISTS "admin read activity" ON public.activity_logs;
DROP POLICY IF EXISTS "admin delete activity" ON public.activity_logs;
CREATE POLICY "admin read activity" ON public.activity_logs
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admin delete activity" ON public.activity_logs
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

-- loyalty_balances
DROP POLICY IF EXISTS "loyalty_balances select staff" ON public.loyalty_balances;
DROP POLICY IF EXISTS "loyalty_balances insert staff" ON public.loyalty_balances;
DROP POLICY IF EXISTS "loyalty_balances update staff" ON public.loyalty_balances;
DROP POLICY IF EXISTS "loyalty_balances delete admin" ON public.loyalty_balances;
CREATE POLICY "loyalty_balances select staff" ON public.loyalty_balances
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'staff'::public.app_role));
CREATE POLICY "loyalty_balances insert staff" ON public.loyalty_balances
  FOR INSERT TO authenticated
  WITH CHECK ((private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'staff'::public.app_role)) AND private.loyalty_key_matches_customer(customer_key));
CREATE POLICY "loyalty_balances update staff" ON public.loyalty_balances
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'staff'::public.app_role))
  WITH CHECK (private.loyalty_key_matches_customer(customer_key));
CREATE POLICY "loyalty_balances delete admin" ON public.loyalty_balances
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(),'admin'::public.app_role));

-- loyalty_transactions
DROP POLICY IF EXISTS "loyalty_transactions select staff" ON public.loyalty_transactions;
DROP POLICY IF EXISTS "loyalty_transactions insert staff" ON public.loyalty_transactions;
DROP POLICY IF EXISTS "loyalty_transactions delete admin" ON public.loyalty_transactions;
CREATE POLICY "loyalty_transactions select staff" ON public.loyalty_transactions
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'staff'::public.app_role));
CREATE POLICY "loyalty_transactions insert staff" ON public.loyalty_transactions
  FOR INSERT TO authenticated
  WITH CHECK ((private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'staff'::public.app_role)) AND private.loyalty_key_matches_customer(customer_key) AND kind = ANY (ARRAY['earn','redeem','adjust']));
CREATE POLICY "loyalty_transactions delete admin" ON public.loyalty_transactions
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(),'admin'::public.app_role));

-- storage.objects (branding + product-images)
DROP POLICY IF EXISTS "staff write branding" ON storage.objects;
DROP POLICY IF EXISTS "staff update branding" ON storage.objects;
DROP POLICY IF EXISTS "admin delete branding" ON storage.objects;
DROP POLICY IF EXISTS "staff write product-images" ON storage.objects;
DROP POLICY IF EXISTS "staff update product-images" ON storage.objects;
DROP POLICY IF EXISTS "admin delete product-images" ON storage.objects;

CREATE POLICY "staff write branding" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'branding' AND (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'staff'::public.app_role)));
CREATE POLICY "staff update branding" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'branding' AND (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'staff'::public.app_role)))
  WITH CHECK (bucket_id = 'branding' AND (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'staff'::public.app_role)));
CREATE POLICY "admin delete branding" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'branding' AND private.has_role(auth.uid(),'admin'::public.app_role));

CREATE POLICY "staff write product-images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'staff'::public.app_role)));
CREATE POLICY "staff update product-images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'staff'::public.app_role)))
  WITH CHECK (bucket_id = 'product-images' AND (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'staff'::public.app_role)));
CREATE POLICY "admin delete product-images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND private.has_role(auth.uid(),'admin'::public.app_role));

-- 4. Drop old public functions
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.loyalty_key_matches_customer(text);
