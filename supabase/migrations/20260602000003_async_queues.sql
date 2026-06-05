-- Queue/Worker Pattern Support
-- This migration adds the necessary triggers to support async processing
-- of contracts and litigation watchlist items.

-- 1. Contract Processing Webhook
-- When a contract status is set to 'queued', trigger the edge function.
CREATE OR REPLACE FUNCTION public.trigger_contract_intake()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status = 'queued' AND (OLD.status IS NULL OR OLD.status != 'queued') THEN
    -- In a real Supabase environment, you'd use pg_net to call the edge function:
    -- SELECT net.http_post(
    --   url := 'https://<ref>.functions.supabase.co/contract-intake',
    --   headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
    --   body := jsonb_build_object('contractId', NEW.id, 'async', false)
    -- );
    NULL; -- Placeholder for architectural documentation
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Audit Trail for Async Jobs
CREATE TABLE IF NOT EXISTS public.async_jobs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id),
  resource_id  UUID NOT NULL,
  resource_type TEXT NOT NULL, -- 'contract' | 'litigation'
  status       TEXT NOT NULL DEFAULT 'pending', -- pending | processing | completed | failed
  error        TEXT,
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.async_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own jobs" ON public.async_jobs FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 3. Utility to enqueue a job
CREATE OR REPLACE FUNCTION public.enqueue_job(
  _resource_id UUID,
  _type TEXT,
  _metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job_id UUID;
BEGIN
  INSERT INTO public.async_jobs (user_id, resource_id, resource_type, metadata)
  VALUES (auth.uid(), _resource_id, _type, _metadata)
  RETURNING id INTO v_job_id;
  
  RETURN v_job_id;
END;
$$;
