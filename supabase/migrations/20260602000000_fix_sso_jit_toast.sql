-- Fix sso_jit_provision to return whether a new membership was actually created
-- to prevent repetitive "Welcome" toasts on every sign-in/refresh.

DROP FUNCTION IF EXISTS public.sso_jit_provision();

CREATE OR REPLACE FUNCTION public.sso_jit_provision()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_uid    UUID := auth.uid();
  v_email  TEXT;
  v_domain TEXT;
  v_org    RECORD;
  v_amr    TEXT;
  v_provider TEXT;
  v_role   org_role;
  v_rows   INT;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  IF v_email IS NULL OR position('@' IN v_email) = 0 THEN RETURN false; END IF;

  v_amr := COALESCE(auth.jwt() ->> 'amr', '');
  v_provider := COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'provider',
    auth.jwt() -> 'user_metadata' ->> 'provider',
    ''
  );

  IF v_amr ILIKE '%password%' OR v_amr ILIKE '%otp%' OR v_amr ILIKE '%email%' THEN
    RETURN false;
  END IF;
  IF v_provider IN ('email', '') AND v_amr NOT ILIKE '%sso%' AND v_amr NOT ILIKE '%oauth%' THEN
    RETURN false;
  END IF;

  v_domain := lower(split_part(v_email, '@', 2));

  SELECT o.id, o.name, s.default_role
    INTO v_org
    FROM public.organization_sso s
    JOIN public.organizations o ON o.id = s.organization_id
   WHERE lower(s.email_domain) = v_domain
     AND s.is_active = true
   LIMIT 1;

  IF v_org.id IS NULL THEN RETURN false; END IF;

  v_role := COALESCE(v_org.default_role, 'member'::org_role);
  IF v_role = 'admin'::org_role THEN
    v_role := 'member'::org_role;
  END IF;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org.id, v_uid, v_role)
  ON CONFLICT (organization_id, user_id) DO NOTHING;
  
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$func$;

REVOKE ALL ON FUNCTION public.sso_jit_provision() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sso_jit_provision() TO authenticated;
