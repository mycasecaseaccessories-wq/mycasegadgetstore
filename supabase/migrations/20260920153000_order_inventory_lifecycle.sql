-- Commit or release reserved physical stock as an order moves through its lifecycle.
CREATE OR REPLACE FUNCTION public.sync_order_inventory_on_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    UPDATE public.products p
    SET reserved_qty = GREATEST(0, COALESCE(p.reserved_qty, 0) - oi.quantity),
        sold_qty = COALESCE(p.sold_qty, 0) + oi.quantity,
        updated_at = now()
    FROM public.order_items oi
    WHERE oi.order_id = NEW.id
      AND oi.product_id = p.id
      AND oi.fulfillment_type = 'IN_STOCK';
  ELSIF NEW.status = 'cancelled' AND OLD.status NOT IN ('cancelled', 'completed') THEN
    UPDATE public.products p
    SET reserved_qty = GREATEST(0, COALESCE(p.reserved_qty, 0) - oi.quantity),
        updated_at = now()
    FROM public.order_items oi
    WHERE oi.order_id = NEW.id
      AND oi.product_id = p.id
      AND oi.fulfillment_type = 'IN_STOCK';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_order_inventory_on_status ON public.orders;
CREATE TRIGGER trg_sync_order_inventory_on_status
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.sync_order_inventory_on_status();

CREATE OR REPLACE FUNCTION public.release_order_inventory_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status NOT IN ('cancelled', 'completed') THEN
    UPDATE public.products p
    SET reserved_qty = GREATEST(0, COALESCE(p.reserved_qty, 0) - oi.quantity),
        updated_at = now()
    FROM public.order_items oi
    WHERE oi.order_id = OLD.id
      AND oi.product_id = p.id
      AND oi.fulfillment_type = 'IN_STOCK';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_release_order_inventory_on_delete ON public.orders;
CREATE TRIGGER trg_release_order_inventory_on_delete
BEFORE DELETE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.release_order_inventory_on_delete();

REVOKE ALL ON FUNCTION public.sync_order_inventory_on_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_order_inventory_on_delete() FROM PUBLIC, anon, authenticated;
