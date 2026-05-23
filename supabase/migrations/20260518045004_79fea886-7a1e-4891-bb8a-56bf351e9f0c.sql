ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS analysis jsonb NOT NULL DEFAULT '{}'::jsonb;