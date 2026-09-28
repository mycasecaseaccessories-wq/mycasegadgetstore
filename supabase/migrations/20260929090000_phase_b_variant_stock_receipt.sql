-- Phase B: keep purchase receipts aligned with product-variant inventory.
ALTER TABLE public.purchase_order_items
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_po_items_variant_id ON public.purchase_order_items(variant_id);

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
  THEN
    IF NEW.variant_id IS NOT NULL THEN
      UPDATE public.product_variants
      SET stock_in = COALESCE(stock_in, 0) + COALESCE(NEW.quantity, 0),
          updated_at = now()
      WHERE id = NEW.variant_id;
    ELSIF NEW.product_id IS NOT NULL THEN
      UPDATE public.products
      SET stock_in = COALESCE(stock_in, 0) + COALESCE(NEW.quantity, 0),
          updated_at = now()
      WHERE id = NEW.product_id;
    END IF;
    NEW.stocked_in := true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_stock_in_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.cargo_status = 'arrived' AND NEW.stocked_in = false THEN
    IF NEW.variant_id IS NOT NULL THEN
      UPDATE public.product_variants
      SET stock_in = COALESCE(stock_in, 0) + COALESCE(NEW.quantity, 0),
          updated_at = now()
      WHERE id = NEW.variant_id;
    ELSIF NEW.product_id IS NOT NULL THEN
      UPDATE public.products
      SET stock_in = COALESCE(stock_in, 0) + COALESCE(NEW.quantity, 0),
          updated_at = now()
      WHERE id = NEW.product_id;
    END IF;
    NEW.stocked_in := true;
  END IF;
  RETURN NEW;
END;
$$;

NOTIFY pgrST, 'reload schema';
