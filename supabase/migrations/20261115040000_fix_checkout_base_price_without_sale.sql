-- Phase 6: preserve the authoritative base price when no sale campaign matches.
-- SELECT INTO assigns NULL to every target when the sale helper returns no row.
-- Keep the base price separately so normal (non-sale) checkout remains valid.
DO $migration$
DECLARE
  v_signature regprocedure;
  v_definition text;
  v_updated text;
BEGIN
  v_signature := 'public.create_guest_order_with_items(text,text,text,numeric,numeric,jsonb,integer)'::regprocedure;
  v_definition := pg_get_functiondef(v_signature);
  v_updated := replace(v_definition,
    '  v_server_price numeric;',
    '  v_server_price numeric;\n  v_base_price numeric;');
  v_updated := replace(v_updated,
    '    SELECT campaign_id, original_price, sale_price, discount_amount',
    '    v_base_price := v_server_price;\n    SELECT campaign_id, original_price, sale_price, discount_amount');
  v_updated := replace(v_updated,
    '      v_server_price := v_original_price;\n      v_sale_discount := 0;',
    '      v_original_price := v_base_price;\n      v_server_price := v_base_price;\n      v_sale_discount := 0;');
  IF v_updated = v_definition OR position('v_base_price := v_server_price;' in v_updated) = 0 THEN
    RAISE EXCEPTION 'Could not safely patch create_guest_order_with_items';
  END IF;
  EXECUTE v_updated;

  v_signature := 'public.create_order_with_items(text,text,text,numeric,numeric,jsonb,integer)'::regprocedure;
  v_definition := pg_get_functiondef(v_signature);
  v_updated := replace(v_definition,
    '  v_server_price numeric;',
    '  v_server_price numeric;\n  v_base_price numeric;');
  v_updated := replace(v_updated,
    '    SELECT campaign_id, original_price, sale_price, discount_amount',
    '    v_base_price := v_server_price;\n    SELECT campaign_id, original_price, sale_price, discount_amount');
  v_updated := replace(v_updated,
    '      v_server_price := v_original_price;\n      v_sale_discount := 0;',
    '      v_original_price := v_base_price;\n      v_server_price := v_base_price;\n      v_sale_discount := 0;');
  IF v_updated = v_definition OR position('v_base_price := v_server_price;' in v_updated) = 0 THEN
    RAISE EXCEPTION 'Could not safely patch create_order_with_items';
  END IF;
  EXECUTE v_updated;
END
$migration$;
