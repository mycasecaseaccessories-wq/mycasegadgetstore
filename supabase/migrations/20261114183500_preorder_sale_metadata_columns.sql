-- Complete checkout pricing metadata omitted from the original migration set.
-- These fields are required by the guest/member preorder RPCs and preserve
-- original price, discount and sale-campaign attribution per order item.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS guest_payment_capability_digest text;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS original_unit_price numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sale_campaign_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'order_items_discount_amount_nonnegative'
      AND conrelid = 'public.order_items'::regclass
  ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_discount_amount_nonnegative
      CHECK (discount_amount >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'order_items_original_unit_price_nonnegative'
      AND conrelid = 'public.order_items'::regclass
  ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_original_unit_price_nonnegative
      CHECK (original_unit_price >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'order_items_sale_campaign_id_fkey'
      AND conrelid = 'public.order_items'::regclass
  ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_sale_campaign_id_fkey
      FOREIGN KEY (sale_campaign_id)
      REFERENCES public.sale_campaigns(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_order_items_sale_campaign_id
  ON public.order_items(sale_campaign_id);

NOTIFY pgrst, 'reload schema';
