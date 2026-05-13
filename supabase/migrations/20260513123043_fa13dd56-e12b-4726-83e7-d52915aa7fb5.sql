-- 1. Add user_id to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS user_id uuid;
CREATE INDEX IF NOT EXISTS orders_user_id_idx ON public.orders(user_id);

-- 2. Tighten orders: drop catch-all auth policy, keep admin/staff full + customers own
DROP POLICY IF EXISTS "auth all orders" ON public.orders;

CREATE POLICY "staff manage orders"
  ON public.orders FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "customers read own orders"
  ON public.orders FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "customers insert own orders"
  ON public.orders FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 3. Tighten order_items
DROP POLICY IF EXISTS "auth all order_items" ON public.order_items;

CREATE POLICY "staff manage order_items"
  ON public.order_items FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "customers read own order_items"
  ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.user_id = auth.uid()));

CREATE POLICY "customers insert own order_items"
  ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.user_id = auth.uid()));

-- 4. Tighten customers table
DROP POLICY IF EXISTS "auth all customers" ON public.customers;

CREATE POLICY "staff manage customers"
  ON public.customers FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'staff'::app_role));

-- 5. Helper function for server fns to look up loyalty balance by user phone
CREATE OR REPLACE FUNCTION private.get_loyalty_points_for_phone(_phone text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT COALESCE(MAX(points), 0)::int
  FROM public.loyalty_balances
  WHERE customer_phone = _phone OR customer_key = _phone;
$$;

REVOKE EXECUTE ON FUNCTION private.get_loyalty_points_for_phone(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.get_loyalty_points_for_phone(text) TO authenticated;