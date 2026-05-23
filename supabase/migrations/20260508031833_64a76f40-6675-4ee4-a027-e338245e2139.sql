CREATE TABLE IF NOT EXISTS public.litigation_watchlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('cnr','keyword','competitor','regulator')),
  label TEXT NOT NULL,
  identifier TEXT NOT NULL,
  notes TEXT,
  last_checked_at TIMESTAMPTZ,
  last_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.litigation_watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "watchlist_select_own" ON public.litigation_watchlist
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "watchlist_insert_own" ON public.litigation_watchlist
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "watchlist_update_own" ON public.litigation_watchlist
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "watchlist_delete_own" ON public.litigation_watchlist
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER litigation_watchlist_set_updated_at
  BEFORE UPDATE ON public.litigation_watchlist
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX idx_litigation_watchlist_user_kind ON public.litigation_watchlist(user_id, kind);