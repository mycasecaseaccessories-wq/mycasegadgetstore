-- Do not grant admin privileges to whichever person happens to sign up first.
-- New customer accounts receive no staff role. The verified store owner must be
-- explicitly promoted through a trusted admin-only provisioning step.
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user_role()
  FROM PUBLIC, anon, authenticated, service_role;
