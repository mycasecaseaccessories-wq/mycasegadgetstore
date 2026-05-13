-- Extend purchase_order_items with cargo + currency tracking
ALTER TABLE public.purchase_order_items
  ADD COLUMN IF NOT EXISTS tracking_code text,
  ADD COLUMN IF NOT EXISTS thb_price numeric,
  ADD COLUMN IF NOT EXISTS cargo_status text NOT NULL DEFAULT 'ordered',
  ADD COLUMN IF NOT EXISTS variant text;

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'THB',
  ADD COLUMN IF NOT EXISTS exchange_rate numeric,
  ADD COLUMN IF NOT EXISTS thb_total numeric NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_po_items_tracking ON public.purchase_order_items (tracking_code);
CREATE INDEX IF NOT EXISTS idx_po_items_cargo_status ON public.purchase_order_items (cargo_status);
CREATE INDEX IF NOT EXISTS idx_po_ordered_at ON public.purchase_orders (ordered_at);