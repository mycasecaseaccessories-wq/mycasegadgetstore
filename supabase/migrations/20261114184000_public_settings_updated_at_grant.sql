-- The invoker-mode public settings helper orders by updated_at.
-- Grant only that additional public column; the storefront still reads
-- business_name/logo_url and the helper returns business_name/logo_url/currency.
GRANT SELECT (updated_at) ON public.settings TO anon;
NOTIFY pgrst, 'reload schema';
