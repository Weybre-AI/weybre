-- Add conversation column to drafts table to enable persistent multi-turn history.

ALTER TABLE public.drafts 
ADD COLUMN IF NOT EXISTS conversation JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Update RLS if needed (already broad enough usually)
-- GRANT ALL ON public.drafts TO authenticated;
