-- Activate pg_net for outbound HTTP calls from Postgres triggers
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Robust Queue/Worker Trigger using pg_net
-- Migration: 20260602000013_active_async_trigger.sql

CREATE OR REPLACE FUNCTION public.trigger_worker_v2()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_url TEXT;
    v_anon_key TEXT;
BEGIN
    -- Only trigger on new queued jobs
    IF NEW.status = 'queued' THEN
        -- Construct function URL (internal Supabase URL often works, but we use the configured one)
        v_url := (SELECT value FROM extensions.settings WHERE name = 'app.settings.supabase_url') || '/functions/v1/document-worker';
        v_anon_key := (SELECT value FROM extensions.settings WHERE name = 'app.settings.service_role_key');

        PERFORM net.http_post(
            url := v_url,
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || v_anon_key
            ),
            body := jsonb_build_object('jobId', NEW.id)
        );
    END IF;
    RETURN NEW;
END;
$$;

-- Drop old placeholder trigger if it exists
DROP TRIGGER IF EXISTS on_job_queued ON public.processing_jobs;

-- Apply to processing_jobs table
CREATE TRIGGER on_job_queued
AFTER INSERT ON public.processing_jobs
FOR EACH ROW EXECUTE FUNCTION public.trigger_worker_v2();
