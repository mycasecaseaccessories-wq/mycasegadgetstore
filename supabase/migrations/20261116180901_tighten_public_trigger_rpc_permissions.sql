-- Tighten public RPC exposure for the isolated preview/test database.
-- Trigger-only functions are not public RPC endpoints.
REVOKE ALL ON FUNCTION public.set_sale_campaign_updated_at()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.sync_purchase_order_receipt_status()
  FROM PUBLIC, anon, authenticated, service_role;

-- Sale pricing reads only catalog rows/columns already exposed by RLS and grants.
-- It does not require elevated SECURITY DEFINER privileges.
ALTER FUNCTION public.get_active_sale_for_item(uuid, uuid, numeric) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.get_active_sale_for_item(uuid, uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_sale_for_item(uuid, uuid, numeric)
  TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
