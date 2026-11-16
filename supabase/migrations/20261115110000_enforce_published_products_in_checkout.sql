-- Keep checkout RPCs consistent with public catalogue publication rules.
-- SECURITY DEFINER functions bypass RLS, so they must explicitly enforce
-- published=true before accepting an order for a product.
DO $migration$
DECLARE
  v_oid regprocedure;
  v_definition text;
  v_old text := 'WHERE id = v_product_id AND status = ''ACTIVE''';
  v_new text := 'WHERE id = v_product_id AND status = ''ACTIVE'' AND published = true';
BEGIN
  FOREACH v_oid IN ARRAY ARRAY[
    'public.create_guest_order_with_items(text,text,text,numeric,numeric,jsonb,integer)'::regprocedure,
    'public.create_order_with_items(text,text,text,numeric,numeric,jsonb,integer)'::regprocedure
  ]
  LOOP
    v_definition := pg_get_functiondef(v_oid);
    IF position(v_old IN v_definition) = 0 THEN
      RAISE EXCEPTION 'Expected product availability check missing in %', v_oid;
    END IF;
    v_definition := replace(v_definition, v_old, v_new);
    EXECUTE v_definition;
  END LOOP;
END
$migration$;
