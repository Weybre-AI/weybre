CREATE TABLE public.draft_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  draft_id UUID NOT NULL REFERENCES public.drafts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  extracted_text TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'uploaded',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.draft_attachments ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_draft_attachments_draft_id ON public.draft_attachments(draft_id);
CREATE INDEX idx_draft_attachments_user_id ON public.draft_attachments(user_id);

CREATE TRIGGER update_draft_attachments_updated_at
BEFORE UPDATE ON public.draft_attachments
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE POLICY "draft_attachments_select_own"
ON public.draft_attachments
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "draft_attachments_insert_own"
ON public.draft_attachments
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.drafts d
    WHERE d.id = draft_id AND d.user_id = auth.uid()
  )
);

CREATE POLICY "draft_attachments_update_own"
ON public.draft_attachments
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "draft_attachments_delete_own"
ON public.draft_attachments
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'draft-documents',
  'draft-documents',
  false,
  20971520,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
    'application/rtf'
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "draft_documents_read_own"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'draft-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "draft_documents_upload_own"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'draft-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "draft_documents_update_own"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'draft-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "draft_documents_delete_own"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'draft-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);