
CREATE UNIQUE INDEX IF NOT EXISTS judgments_external_id_uniq
  ON public.judgments (external_id)
  WHERE external_id IS NOT NULL;
