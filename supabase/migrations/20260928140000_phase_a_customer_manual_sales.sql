-- Phase A: admin-managed customer details and manual sales.
-- Additive only; online customer checkout remains separate.
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS phone_2 text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS region text;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_source text NOT NULL DEFAULT 'ONLINE',
  ADD COLUMN IF NOT EXISTS deposit_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS tracking_number text;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_order_source_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_order_source_check
  CHECK (order_source IN ('ONLINE', 'MANUAL'));

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_delivery_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_delivery_status_check
  CHECK (delivery_status IN ('PENDING', 'PREPARING', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'RETURNED'));

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_deposit_amount_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_deposit_amount_check CHECK (deposit_amount >= 0);

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_balance_amount_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_balance_amount_check CHECK (balance_amount >= 0);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);
CREATE INDEX IF NOT EXISTS idx_orders_customer_source ON public.orders(customer_id, order_source);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_status ON public.orders(delivery_status);

-- Backfill existing online orders without changing their financial totals.
UPDATE public.orders
SET order_source = 'ONLINE',
    deposit_amount = CASE WHEN payment_status = 'paid' THEN total ELSE 0 END,
    balance_amount = CASE WHEN payment_status = 'paid' THEN 0 ELSE total END,
    delivery_status = CASE
      WHEN status = 'completed' THEN 'COMPLETED'
      WHEN status = 'cancelled' THEN 'CANCELLED'
      WHEN status = 'processing' THEN 'PREPARING'
      WHEN status = 'paid' THEN 'PREPARING'
      ELSE 'PENDING'
    END
WHERE order_source IS NULL OR deposit_amount = 0 AND balance_amount = 0;

NOTIFY pgrST, 'reload schema';
