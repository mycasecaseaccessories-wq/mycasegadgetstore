
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['customers','expenses','notes','order_items','orders','product_variants','products','purchase_order_items','purchase_orders','rates','settings','suppliers','vouchers'];
  pname text;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    FOR pname IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname LIKE 'auth all%'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pname, t);
    END LOOP;
    EXECUTE format('CREATE POLICY "auth all %I" ON public.%I FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL)', t, t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "public insert customers" ON public.customers;
CREATE POLICY "public insert customers" ON public.customers
  FOR INSERT TO anon
  WITH CHECK (phone IS NOT NULL AND length(btrim(phone)) > 0);

DROP POLICY IF EXISTS "public insert orders" ON public.orders;
CREATE POLICY "public insert orders" ON public.orders
  FOR INSERT TO anon
  WITH CHECK (customer_id IS NOT NULL);

DROP POLICY IF EXISTS "public insert order_items" ON public.order_items;
CREATE POLICY "public insert order_items" ON public.order_items
  FOR INSERT TO anon
  WITH CHECK (order_id IS NOT NULL AND quantity > 0);

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.loyalty_key_matches_customer(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, public, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.loyalty_key_matches_customer(text) TO authenticated;
