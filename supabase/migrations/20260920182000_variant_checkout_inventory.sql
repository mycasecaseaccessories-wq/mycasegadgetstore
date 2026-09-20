-- Carry the selected variant through checkout and keep variant inventory atomic.
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_order_items_variant_id
  ON public.order_items (variant_id);

CREATE OR REPLACE FUNCTION public.create_order_with_items(
  p_customer_name text,
  p_customer_phone text,
  p_delivery_note text,
  p_discount numeric,
  p_extra_fee numeric,
  p_items jsonb,
  p_redeem_points integer DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_order_id uuid;
  v_subtotal numeric := 0;
  v_discount numeric := COALESCE(p_discount, 0);
  v_extra_fee numeric := COALESCE(p_extra_fee, 0);
  v_redeem_points integer := COALESCE(p_redeem_points, 0);
  v_redeem_value numeric := 0;
  v_total numeric;
  v_balance integer := 0;
  v_min_redeem integer := 0;
  v_redeem_rate numeric := 0;
  v_key text := NULLIF(btrim(COALESCE(p_customer_phone, '')), '');
  v_product record;
  v_variant record;
  v_product_id uuid;
  v_variant_id uuid;
  v_quantity integer;
  v_server_price numeric;
  v_available integer;
  v_fulfillment text;
  v_deposit numeric;
  v_eta text;
  item jsonb;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one order item is required';
  END IF;
  IF v_discount < 0 OR v_extra_fee < 0 OR v_redeem_points < 0 THEN
    RAISE EXCEPTION 'Invalid discount, fee, or loyalty points';
  END IF;

  -- Validate and reserve every item while holding the relevant row lock.
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    BEGIN
      v_product_id := NULLIF(item ->> 'product_id', '')::uuid;
      v_variant_id := NULLIF(item ->> 'variant_id', '')::uuid;
      v_quantity := (item ->> 'quantity')::integer;
      v_fulfillment := upper(COALESCE(NULLIF(item ->> 'fulfillment_type', ''), 'IN_STOCK'));
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Malformed order item';
    END;

    IF v_product_id IS NULL OR v_quantity IS NULL OR v_quantity <= 0 OR v_quantity > 1000 THEN
      RAISE EXCEPTION 'Invalid order item values';
    END IF;
    IF v_fulfillment NOT IN ('IN_STOCK', 'PREORDER') THEN
      RAISE EXCEPTION 'Invalid fulfillment type';
    END IF;

    SELECT * INTO v_product
      FROM public.products
      WHERE id = v_product_id AND status = 'ACTIVE'
      FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Product is unavailable'; END IF;

    IF v_variant_id IS NOT NULL THEN
      SELECT * INTO v_variant
        FROM public.product_variants
        WHERE id = v_variant_id AND product_id = v_product_id AND status = 'ACTIVE'
        FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Selected variant is unavailable'; END IF;

      v_server_price := COALESCE(v_variant.final_sell_mmk, v_variant.price, 0);
      IF v_server_price < 0 THEN RAISE EXCEPTION 'Invalid product price'; END IF;
      IF v_fulfillment = 'PREORDER' THEN
        IF NOT COALESCE(v_variant.preorder_enabled, false)
           OR v_variant.selling_mode NOT IN ('PREORDER', 'BOTH') THEN
          RAISE EXCEPTION 'Pre-order is not available for this variant';
        END IF;
      ELSE
        v_available := COALESCE(v_variant.stock_in, 0)
          - COALESCE(v_variant.sold_qty, 0)
          - COALESCE(v_variant.reserved_qty, 0);
        IF v_available < v_quantity THEN
          RAISE EXCEPTION 'Insufficient stock for selected variant';
        END IF;
        UPDATE public.product_variants
          SET reserved_qty = COALESCE(reserved_qty, 0) + v_quantity,
              updated_at = now()
          WHERE id = v_variant_id;
      END IF;
    ELSE
      v_server_price := COALESCE(v_product.final_sell_mmk, v_product.price, 0);
      IF v_server_price < 0 THEN RAISE EXCEPTION 'Invalid product price'; END IF;
      IF v_fulfillment = 'PREORDER' THEN
        IF NOT COALESCE(v_product.preorder_enabled, false)
           OR v_product.selling_mode NOT IN ('PREORDER', 'BOTH') THEN
          RAISE EXCEPTION 'Pre-order is not available for this product';
        END IF;
      ELSE
        v_available := COALESCE(v_product.stock_in, 0)
          - COALESCE(v_product.sold_qty, 0)
          - COALESCE(v_product.reserved_qty, 0);
        IF v_available < v_quantity THEN
          RAISE EXCEPTION 'Insufficient stock for %', v_product.name;
        END IF;
        UPDATE public.products
          SET reserved_qty = COALESCE(reserved_qty, 0) + v_quantity,
              updated_at = now()
          WHERE id = v_product_id;
      END IF;
    END IF;
    v_subtotal := v_subtotal + (v_server_price * v_quantity);
  END LOOP;

  IF v_redeem_points > 0 THEN
    IF v_key IS NULL THEN RAISE EXCEPTION 'A phone number is required to redeem points'; END IF;
    SELECT COALESCE(loyalty_min_redeem, 0), COALESCE(loyalty_redeem_value, 0)
      INTO v_min_redeem, v_redeem_rate
      FROM public.settings ORDER BY updated_at DESC LIMIT 1;
    IF v_redeem_points < v_min_redeem OR v_redeem_rate <= 0 THEN
      RAISE EXCEPTION 'Invalid loyalty redemption';
    END IF;
    SELECT points INTO v_balance
      FROM public.loyalty_balances WHERE customer_key = v_key FOR UPDATE;
    IF COALESCE(v_balance, 0) < v_redeem_points THEN
      RAISE EXCEPTION 'Insufficient loyalty points';
    END IF;
    v_redeem_value := LEAST(v_subtotal - v_discount + v_extra_fee, v_redeem_points * v_redeem_rate);
  END IF;

  v_total := v_subtotal - v_discount + v_extra_fee - v_redeem_value;
  IF v_total < 0 THEN RAISE EXCEPTION 'Invalid order total'; END IF;

  INSERT INTO public.orders (
    user_id, customer_name, customer_phone, delivery_note, subtotal, discount, extra_fee,
    total, points_redeemed, points_value, status, payment_status
  ) VALUES (
    v_user_id, NULLIF(btrim(p_customer_name), ''), v_key, p_delivery_note, v_subtotal,
    v_discount + v_redeem_value, v_extra_fee, v_total, v_redeem_points, v_redeem_value,
    'pending', 'unpaid'
  ) RETURNING id INTO v_order_id;

  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := NULLIF(item ->> 'product_id', '')::uuid;
    v_variant_id := NULLIF(item ->> 'variant_id', '')::uuid;
    v_quantity := (item ->> 'quantity')::integer;
    v_fulfillment := upper(COALESCE(NULLIF(item ->> 'fulfillment_type', ''), 'IN_STOCK'));

    IF v_variant_id IS NOT NULL THEN
      SELECT COALESCE(final_sell_mmk, price, 0), waiting_time,
        CASE WHEN preorder_deposit_type = 'PERCENTAGE'
          THEN LEAST(COALESCE(final_sell_mmk, price, 0), COALESCE(final_sell_mmk, price, 0) * LEAST(100, GREATEST(0, preorder_deposit)) / 100)
          ELSE LEAST(COALESCE(final_sell_mmk, price, 0), GREATEST(0, preorder_deposit)) END
        INTO v_server_price, v_eta, v_deposit
        FROM public.product_variants WHERE id = v_variant_id;
    ELSE
      SELECT COALESCE(final_sell_mmk, price, 0), waiting_time,
        CASE WHEN preorder_deposit_type = 'PERCENTAGE'
          THEN LEAST(COALESCE(final_sell_mmk, price, 0), COALESCE(final_sell_mmk, price, 0) * LEAST(100, GREATEST(0, preorder_deposit)) / 100)
          ELSE LEAST(COALESCE(final_sell_mmk, price, 0), GREATEST(0, preorder_deposit)) END
        INTO v_server_price, v_eta, v_deposit
        FROM public.products WHERE id = v_product_id;
    END IF;

    INSERT INTO public.order_items (
      order_id, product_id, variant_id, product_name, unit_price, quantity, line_total,
      fulfillment_type, estimated_arrival, deposit_required
    ) VALUES (
      v_order_id, v_product_id, v_variant_id, btrim(COALESCE(item ->> 'product_name', 'Product')),
      v_server_price, v_quantity, v_server_price * v_quantity, v_fulfillment,
      CASE WHEN v_fulfillment = 'PREORDER' THEN v_eta ELSE NULL END,
      CASE WHEN v_fulfillment = 'PREORDER' THEN v_deposit ELSE 0 END
    );
  END LOOP;

  IF v_redeem_points > 0 THEN
    UPDATE public.loyalty_balances
      SET points = points - v_redeem_points, updated_at = now()
      WHERE customer_key = v_key;
    INSERT INTO public.loyalty_transactions (customer_key, order_id, kind, delta, value, note)
    VALUES (v_key, v_order_id, 'redeem', -v_redeem_points, v_redeem_value, 'Redeemed at checkout');
  END IF;
  RETURN v_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_order_inventory_on_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    UPDATE public.products p
      SET reserved_qty = GREATEST(0, COALESCE(p.reserved_qty, 0) - oi.quantity),
          sold_qty = COALESCE(p.sold_qty, 0) + oi.quantity, updated_at = now()
      FROM public.order_items oi
      WHERE oi.order_id = NEW.id AND oi.variant_id IS NULL AND oi.product_id = p.id
        AND oi.fulfillment_type = 'IN_STOCK';
    UPDATE public.product_variants v
      SET reserved_qty = GREATEST(0, COALESCE(v.reserved_qty, 0) - oi.quantity),
          sold_qty = COALESCE(v.sold_qty, 0) + oi.quantity, updated_at = now()
      FROM public.order_items oi
      WHERE oi.order_id = NEW.id AND oi.variant_id = v.id
        AND oi.fulfillment_type = 'IN_STOCK';
  ELSIF NEW.status = 'cancelled' AND OLD.status NOT IN ('cancelled', 'completed') THEN
    UPDATE public.products p
      SET reserved_qty = GREATEST(0, COALESCE(p.reserved_qty, 0) - oi.quantity), updated_at = now()
      FROM public.order_items oi
      WHERE oi.order_id = NEW.id AND oi.variant_id IS NULL AND oi.product_id = p.id
        AND oi.fulfillment_type = 'IN_STOCK';
    UPDATE public.product_variants v
      SET reserved_qty = GREATEST(0, COALESCE(v.reserved_qty, 0) - oi.quantity), updated_at = now()
      FROM public.order_items oi
      WHERE oi.order_id = NEW.id AND oi.variant_id = v.id
        AND oi.fulfillment_type = 'IN_STOCK';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_order_inventory_on_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status NOT IN ('cancelled', 'completed') THEN
    UPDATE public.products p
      SET reserved_qty = GREATEST(0, COALESCE(p.reserved_qty, 0) - oi.quantity), updated_at = now()
      FROM public.order_items oi
      WHERE oi.order_id = OLD.id AND oi.variant_id IS NULL AND oi.product_id = p.id
        AND oi.fulfillment_type = 'IN_STOCK';
    UPDATE public.product_variants v
      SET reserved_qty = GREATEST(0, COALESCE(v.reserved_qty, 0) - oi.quantity), updated_at = now()
      FROM public.order_items oi
      WHERE oi.order_id = OLD.id AND oi.variant_id = v.id
        AND oi.fulfillment_type = 'IN_STOCK';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_order_inventory_on_status ON public.orders;
CREATE TRIGGER trg_sync_order_inventory_on_status
AFTER UPDATE OF status ON public.orders
FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.sync_order_inventory_on_status();

DROP TRIGGER IF EXISTS trg_release_order_inventory_on_delete ON public.orders;
CREATE TRIGGER trg_release_order_inventory_on_delete
BEFORE DELETE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.release_order_inventory_on_delete();

REVOKE ALL ON FUNCTION public.create_order_with_items(text, text, text, numeric, numeric, jsonb, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_order_with_items(text, text, text, numeric, numeric, jsonb, integer) TO authenticated;
REVOKE ALL ON FUNCTION public.sync_order_inventory_on_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_order_inventory_on_delete() FROM PUBLIC, anon, authenticated;
