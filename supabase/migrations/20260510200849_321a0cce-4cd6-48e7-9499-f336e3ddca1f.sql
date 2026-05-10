-- Activity logs (audit trail) - additive, no changes to existing tables
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_name text,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  summary text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON public.activity_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON public.activity_logs (user_id);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can insert their own activity rows
CREATE POLICY "auth insert own activity"
ON public.activity_logs FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Only admins can read the audit trail
CREATE POLICY "admin read activity"
ON public.activity_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Only admins can delete (for cleanup)
CREATE POLICY "admin delete activity"
ON public.activity_logs FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));