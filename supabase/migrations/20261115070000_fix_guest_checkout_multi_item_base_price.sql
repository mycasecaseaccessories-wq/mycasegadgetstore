-- Preserve each guest order item's own base price in the second item pass.
-- The first pass leaves v_base_price holding the last item's value. The second
-- pass must refresh it after reading each product/variant before sale lookup.
DO $migration$
DECLARE
  v_function_oid oid;
  v_definition text;
  v_old text := $old$
    END IF;

    v_sale_discount := 0;
    v_sale_campaign_id := NULL;
    SELECT campaign_id, sale_price, discount_amount
$old$;
  v_new text := $new$
    END IF;

    v_base_price := v_original_price;
    v_sale_discount := 0;
    v_sale_campaign_id := NULL;
    SELECT campaign_id, sale_price, discount_amount
$new$;
BEGIN
  v_function_oid := 'public.create_guest_order_with_items(text,text,text,numeric,numeric,jsonb,integer)'::regprocedure;
  v_definition := pg_get_functiondef(v_function_oid);

  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Expected guest checkout second-pass pricing block was not found; refusing to patch';
  END IF;

  v_definition := replace(v_definition, v_old, v_new);
  EXECUTE v_definition;
END
$migration$;
