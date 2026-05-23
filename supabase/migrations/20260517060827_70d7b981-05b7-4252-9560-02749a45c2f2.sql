
-- contracts table
CREATE TABLE public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  matter_id uuid REFERENCES public.matters(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  mime_type text NOT NULL,
  file_size integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'uploaded', -- uploaded | processing | ready | failed | needs_review
  error_message text,
  -- classification
  doc_type text,
  doc_type_confidence numeric NOT NULL DEFAULT 0,
  jurisdiction text,
  governing_law text,
  risk_level text, -- LOW | MEDIUM | HIGH
  risk_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- entities
  parties jsonb NOT NULL DEFAULT '[]'::jsonb,
  effective_date date,
  expiry_date date,
  renewal_window text,
  termination_clause text,
  -- ops
  extracted_text text NOT NULL DEFAULT '',
  char_count integer NOT NULL DEFAULT 0,
  parse_method text,
  model text,
  needs_human_review boolean NOT NULL DEFAULT false,
  human_label text,
  human_reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contracts_user ON public.contracts(user_id, created_at DESC);
CREATE INDEX idx_contracts_type ON public.contracts(doc_type);
CREATE INDEX idx_contracts_review ON public.contracts(needs_human_review) WHERE needs_human_review = true;
CREATE INDEX idx_contracts_expiry ON public.contracts(expiry_date) WHERE expiry_date IS NOT NULL;

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY contracts_select_own ON public.contracts FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));
CREATE POLICY contracts_insert_own ON public.contracts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY contracts_update_own ON public.contracts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY contracts_delete_own ON public.contracts FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER contracts_updated_at BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Realtime
ALTER TABLE public.contracts REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.contracts;

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('contract-intake', 'contract-intake', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "contract_intake_select_own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'contract-intake' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "contract_intake_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contract-intake' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "contract_intake_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'contract-intake' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "contract_intake_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'contract-intake' AND auth.uid()::text = (storage.foldername(name))[1]);
