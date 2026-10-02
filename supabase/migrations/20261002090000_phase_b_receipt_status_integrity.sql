-- Phase B completion: keep purchase-order status consistent with received lines.
-- Once a line has stocked into inventory, it cannot be moved backwards without
-- a dedicated reversal workflow, which prevents silent stock mismatches.
CREATE OR REPLACE FUNCTION public.prevent_received_line_reversal()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.cargo_status = 'arrived' AND NEW.cargo_status <> 'arrived' THEN
    RAISE EXCEPTION 'Received purchase item cannot be moved backwards after stock-in';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_received_line_reversal ON public.purchase_order_items;
CREATE TRIGGER trg_prevent_received_line_reversal
  BEFORE UPDATE OF cargo_status ON public.purchase_order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_received_line_reversal();

CREATE OR REPLACE FUNCTION public.sync_purchase_order_receipt_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  remaining integer;
BEGIN
  SELECT count(*) INTO remaining
  FROM public.purchase_order_items
  WHERE po_id = NEW.po_id AND cargo_status <> 'arrived';

  IF remaining = 0 THEN
    UPDATE public.purchase_orders
    SET status = 'received', received_at = COALESCE(received_at, CURRENT_DATE), updated_at = now()
    WHERE id = NEW.po_id;
  ELSE
    UPDATE public.purchase_orders
    SET status = 'partial', updated_at = now()
    WHERE id = NEW.po_id AND status <> 'received';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_purchase_order_receipt_status ON public.purchase_order_items;
CREATE TRIGGER trg_sync_purchase_order_receipt_status
  AFTER INSERT OR UPDATE OF cargo_status ON public.purchase_order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_purchase_order_receipt_status();

NOTIFY pgrST, 'reload schema';
