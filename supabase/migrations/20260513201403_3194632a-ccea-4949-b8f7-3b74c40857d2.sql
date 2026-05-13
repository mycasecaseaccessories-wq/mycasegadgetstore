-- PO: cargo fee + supplier payment tracking
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS cargo_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid';

-- PO items: track auto stock-in
ALTER TABLE public.purchase_order_items
  ADD COLUMN IF NOT EXISTS stocked_in boolean NOT NULL DEFAULT false;

-- Auto stock-in trigger when cargo_status -> 'arrived'
CREATE OR REPLACE FUNCTION public.auto_stock_in_on_arrival()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.cargo_status = 'arrived'
     AND COALESCE(OLD.cargo_status, '') <> 'arrived'
     AND NEW.stocked_in = false
     AND NEW.product_id IS NOT NULL
  THEN
    UPDATE public.products
      SET stock_in = COALESCE(stock_in, 0) + COALESCE(NEW.quantity, 0),
          updated_at = now()
      WHERE id = NEW.product_id;
    NEW.stocked_in := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_stock_in ON public.purchase_order_items;
CREATE TRIGGER trg_auto_stock_in
  BEFORE UPDATE OF cargo_status ON public.purchase_order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_stock_in_on_arrival();

-- Also handle INSERT case (line created already as arrived)
CREATE OR REPLACE FUNCTION public.auto_stock_in_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.cargo_status = 'arrived'
     AND NEW.stocked_in = false
     AND NEW.product_id IS NOT NULL
  THEN
    UPDATE public.products
      SET stock_in = COALESCE(stock_in, 0) + COALESCE(NEW.quantity, 0),
          updated_at = now()
      WHERE id = NEW.product_id;
    NEW.stocked_in := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_stock_in_ins ON public.purchase_order_items;
CREATE TRIGGER trg_auto_stock_in_ins
  BEFORE INSERT ON public.purchase_order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_stock_in_on_insert();