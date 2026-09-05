-- Production hardening: reject invalid future financial and inventory records.
-- NOT VALID keeps this migration safe for existing legacy rows while enforcing
-- the invariant for every new or updated row.

ALTER TABLE public.products
  ADD CONSTRAINT products_price_nonnegative CHECK (price >= 0) NOT VALID,
  ADD CONSTRAINT products_stock_nonnegative CHECK (stock_in >= 0) NOT VALID,
  ADD CONSTRAINT products_sold_nonnegative CHECK (sold_qty >= 0) NOT VALID;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_subtotal_nonnegative CHECK (subtotal >= 0) NOT VALID,
  ADD CONSTRAINT orders_discount_nonnegative CHECK (discount >= 0) NOT VALID,
  ADD CONSTRAINT orders_extra_fee_nonnegative CHECK (extra_fee >= 0) NOT VALID,
  ADD CONSTRAINT orders_total_nonnegative CHECK (total >= 0) NOT VALID,
  ADD CONSTRAINT orders_status_allowed CHECK (status IN ('pending', 'paid', 'processing', 'completed', 'cancelled')) NOT VALID,
  ADD CONSTRAINT orders_payment_status_allowed CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'refunded')) NOT VALID;

ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_quantity_positive CHECK (quantity > 0) NOT VALID,
  ADD CONSTRAINT order_items_unit_price_nonnegative CHECK (unit_price >= 0) NOT VALID,
  ADD CONSTRAINT order_items_line_total_nonnegative CHECK (line_total >= 0) NOT VALID;

CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_role_uidx
  ON public.user_roles (user_id, role);
CREATE INDEX IF NOT EXISTS orders_created_at_idx
  ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS orders_customer_phone_idx
  ON public.orders (customer_phone);
CREATE INDEX IF NOT EXISTS products_status_created_at_idx
  ON public.products (status, created_at DESC);
CREATE INDEX IF NOT EXISTS order_items_product_id_idx
  ON public.order_items (product_id);

COMMENT ON CONSTRAINT orders_status_allowed ON public.orders IS
  'Allowed workflow states for production order management';
COMMENT ON CONSTRAINT orders_payment_status_allowed ON public.orders IS
  'Allowed payment states for production order management';

-- Force PostgREST clients to use the explicitly scoped policies already defined
-- by the prior hardening migrations; this is intentionally a no-op for tables
-- whose policies are already correct and keeps this migration idempotent.
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
