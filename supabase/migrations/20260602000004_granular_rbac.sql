-- Granular RBAC for Enterprise Law Firms
-- This migration extends the user_roles to support more specific firm hierarchies.

-- 1. Extend app_role enum (safe)
DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'partner';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'associate';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'billing_admin';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Enhanced has_role check that supports hierarchy
CREATE OR REPLACE FUNCTION public.has_role_v2(_user_id UUID, _required_role TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_role TEXT;
BEGIN
  SELECT role::text INTO v_user_role FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
  
  -- Super-admin always wins
  IF v_user_role = 'admin' THEN RETURN TRUE; END IF;
  
  -- Hierarchy: admin > partner > lawyer > associate
  IF _required_role = 'lawyer' AND v_user_role IN ('admin', 'partner', 'lawyer') THEN RETURN TRUE; END IF;
  IF _required_role = 'associate' AND v_user_role IN ('admin', 'partner', 'lawyer', 'associate') THEN RETURN TRUE; END IF;
  
  RETURN v_user_role = _required_role;
END;
$$;

-- 3. Org-level Permissions (Member Roles are already Granular: owner, admin, member)
-- We add a more specific permission check function.
CREATE OR REPLACE FUNCTION public.check_org_permission(_user_id UUID, _org_id UUID, _permission TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role org_role;
BEGIN
  SELECT role INTO v_role 
    FROM public.organization_members 
   WHERE user_id = _user_id AND organization_id = _org_id 
   LIMIT 1;

  IF v_role = 'owner' THEN RETURN TRUE; END IF;
  
  IF _permission = 'invite_user' AND v_role IN ('owner', 'admin') THEN RETURN TRUE; END IF;
  IF _permission = 'billing_manage' AND v_role IN ('owner', 'admin') THEN RETURN TRUE; END IF;
  IF _permission = 'data_view' AND v_role IS NOT NULL THEN RETURN TRUE; END IF;

  RETURN FALSE;
END;
$$;
