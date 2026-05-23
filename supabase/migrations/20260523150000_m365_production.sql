-- Microsoft 365 production: server-side tokens, activity logs, safe client view

-- Revoke client writes of OAuth secrets (edge functions use service_role)
DROP POLICY IF EXISTS "m365_insert_own" ON public.m365_connections;
DROP POLICY IF EXISTS "m365_update_own" ON public.m365_connections;

-- Feature toggles on connection row (before view)
ALTER TABLE public.m365_connections
  ADD COLUMN IF NOT EXISTS teams_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sharepoint_enabled BOOLEAN NOT NULL DEFAULT true;

-- Safe status view (no access_token / refresh_token exposed to clients)
DROP VIEW IF EXISTS public.m365_connection_status;
CREATE VIEW public.m365_connection_status
WITH (security_invoker = true) AS
SELECT
  user_id,
  ms_user_id,
  ms_email,
  ms_name,
  scopes,
  onedrive_enabled,
  calendar_enabled,
  teams_enabled,
  sharepoint_enabled,
  connected_at,
  last_used_at,
  token_expires_at,
  (token_expires_at IS NULL OR token_expires_at > now()) AS token_valid
FROM public.m365_connections;

GRANT SELECT ON public.m365_connection_status TO authenticated;

-- Teams message log
CREATE TABLE IF NOT EXISTS public.teams_posts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id      TEXT NOT NULL,
  channel_id   TEXT NOT NULL,
  message_id   TEXT,
  web_url      TEXT,
  preview      TEXT,
  matter_id    UUID REFERENCES public.matters(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.teams_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS teams_posts_select_own ON public.teams_posts;
CREATE POLICY teams_posts_select_own ON public.teams_posts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_teams_posts_user ON public.teams_posts(user_id, created_at DESC);

-- SharePoint upload log
CREATE TABLE IF NOT EXISTS public.sharepoint_exports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  site_id      TEXT NOT NULL,
  drive_id     TEXT,
  item_id      TEXT,
  web_url      TEXT NOT NULL,
  file_name    TEXT NOT NULL,
  matter_id    UUID REFERENCES public.matters(id) ON DELETE SET NULL,
  draft_id     UUID REFERENCES public.drafts(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sharepoint_exports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sharepoint_exports_select_own ON public.sharepoint_exports;
CREATE POLICY sharepoint_exports_select_own ON public.sharepoint_exports
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_sharepoint_exports_user ON public.sharepoint_exports(user_id, created_at DESC);
