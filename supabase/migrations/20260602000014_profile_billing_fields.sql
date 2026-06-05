-- Add billing metadata fields to profiles
-- Migration: 20260602000014_profile_billing_fields.sql

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS billing_address TEXT,
ADD COLUMN IF NOT EXISTS billing_state TEXT,
ADD COLUMN IF NOT EXISTS billing_zip TEXT,
ADD COLUMN IF NOT EXISTS gstin TEXT;

-- Update RLS (already enabled)
