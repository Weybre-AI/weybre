-- Microsoft 365 Integration
-- Stores per-user Microsoft OAuth tokens so edge functions can call
-- Graph API (OneDrive, Outlook Calendar) on behalf of the user.
-- The provider_token from Supabase's Azure OAuth is short-lived (~1h);
-- we store it here so the UI can check connection status without
-- re-reading the session, and edge functions can use it server-side.

CREATE TABLE public.m365_connections (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  -- Microsoft user identity
  ms_user_id    TEXT,                        -- Graph /me id
  ms_email      TEXT,                        -- Microsoft account email
  ms_name       TEXT,                        -- display name from Graph
  -- Tokens (stored encrypted at rest by Postgres/Supabase)
  access_token  TEXT NOT NULL,               -- short-lived Graph access token
  refresh_token TEXT,                        -- offline_access refresh token
  token_expires_at TIMESTAMPTZ,             -- when access_token expires
  -- Granted scopes (space-separated, as returned by Azure)
  scopes        TEXT NOT NULL DEFAULT '',
  -- Sync preferences
  onedrive_enabled   BOOLEAN NOT NULL DEFAULT true,
  calendar_enabled   BOOLEAN NOT NULL DEFAULT true,
  -- Audit
  connected_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at  TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.m365_connections ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own connection record
CREATE POLICY "m365_select_own" ON public.m365_connections
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "m365_insert_own" ON public.m365_connections
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "m365_update_own" ON public.m365_connections
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "m365_delete_own" ON public.m365_connections
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all connections (for support/audit)
CREATE POLICY "m365_admin_select" ON public.m365_connections
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER m365_connections_updated_at
  BEFORE UPDATE ON public.m365_connections
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX idx_m365_connections_user ON public.m365_connections(user_id);

-- ============================================================
-- Outlook Calendar events log
-- Tracks every calendar event created via Weybre AI so users
-- can see what was synced and avoid duplicates.
-- ============================================================
CREATE TABLE public.outlook_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  matter_id       UUID REFERENCES public.matters(id) ON DELETE SET NULL,
  -- Graph API identifiers
  ms_event_id     TEXT NOT NULL,             -- Graph event id (for updates/deletes)
  ms_event_url    TEXT,                      -- webLink to open in Outlook
  -- Event details (denormalised for display)
  subject         TEXT NOT NULL,
  start_at        TIMESTAMPTZ NOT NULL,
  end_at          TIMESTAMPTZ NOT NULL,
  location        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.outlook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "outlook_events_select_own" ON public.outlook_events
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "outlook_events_insert_own" ON public.outlook_events
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "outlook_events_delete_own" ON public.outlook_events
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_outlook_events_user ON public.outlook_events(user_id, start_at DESC);
CREATE INDEX idx_outlook_events_matter ON public.outlook_events(matter_id);

-- ============================================================
-- OneDrive exports log
-- Tracks every file pushed to OneDrive from Weybre AI.
-- ============================================================
CREATE TABLE public.onedrive_exports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  draft_id        UUID REFERENCES public.drafts(id) ON DELETE SET NULL,
  matter_id       UUID REFERENCES public.matters(id) ON DELETE SET NULL,
  -- Graph API identifiers
  ms_item_id      TEXT,                      -- DriveItem id (for future updates)
  ms_web_url      TEXT NOT NULL,             -- direct link to file in OneDrive
  -- File details
  file_name       TEXT NOT NULL,
  file_size       INTEGER,
  format          TEXT NOT NULL DEFAULT 'docx', -- docx | pdf
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.onedrive_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "onedrive_exports_select_own" ON public.onedrive_exports
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "onedrive_exports_insert_own" ON public.onedrive_exports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_onedrive_exports_user ON public.onedrive_exports(user_id, created_at DESC);
CREATE INDEX idx_onedrive_exports_draft ON public.onedrive_exports(draft_id);
