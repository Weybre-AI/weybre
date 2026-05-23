-- Critical security lockdown: RPC grants, subscriptions, M365 tokens, SSO JIT fix

-- 1. Credit RPC: edge functions only (service_role)
REVOKE EXECUTE ON FUNCTION public.deduct_credits(uuid, text, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_credits(uuid, text, jsonb) TO service_role;

-- 2. Judgment search: edge functions only
REVOKE EXECUTE ON FUNCTION public.search_judgments(text, extensions.vector, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.search_judgments(text, extensions.vector, integer) TO service_role;

-- 3. Subscriptions: no client INSERT (prevents self-grant active/enterprise)
DROP POLICY IF EXISTS "subs_insert_own" ON public.subscriptions;

-- 4. M365: clients must not read OAuth secrets from base table
DROP POLICY IF EXISTS "m365_select_own" ON public.m365_connections;
DROP POLICY IF EXISTS "m365_admin_select" ON public.m365_connections;

-- 5. Org SSO config: admins read-only (writes via edge function / service_role)
DROP POLICY IF EXISTS "org_sso_write_admin" ON public.organization_sso;
CREATE POLICY "org_sso_admin_select" ON public.organization_sso
  FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id) AND public.has_org_role(auth.uid(), organization_id, 'admin'));

-- 6. SSO JIT: fix column name is_active (was is_enabled in broken migration)
DROP FUNCTION IF EXISTS public.sso_jit_provision();
CREATE OR REPLACE FUNCTION public.sso_jit_provision()
RETURNS void
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
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  IF v_email IS NULL OR position('@' IN v_email) = 0 THEN RETURN; END IF;

  v_amr := COALESCE(auth.jwt() ->> 'amr', '');
  v_provider := COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'provider',
    auth.jwt() -> 'user_metadata' ->> 'provider',
    ''
  );

  IF v_amr ILIKE '%password%' OR v_amr ILIKE '%otp%' OR v_amr ILIKE '%email%' THEN
    RETURN;
  END IF;
  IF v_provider IN ('email', '') AND v_amr NOT ILIKE '%sso%' AND v_amr NOT ILIKE '%oauth%' THEN
    RETURN;
  END IF;

  v_domain := lower(split_part(v_email, '@', 2));

  SELECT o.id, o.name, s.default_role
    INTO v_org
    FROM public.organization_sso s
    JOIN public.organizations o ON o.id = s.organization_id
   WHERE lower(s.email_domain) = v_domain
     AND s.is_active = true
   LIMIT 1;

  IF v_org.id IS NULL THEN RETURN; END IF;

  v_role := COALESCE(v_org.default_role, 'member'::org_role);
  IF v_role = 'admin'::org_role THEN
    v_role := 'member'::org_role;
  END IF;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org.id, v_uid, v_role)
  ON CONFLICT (organization_id, user_id) DO NOTHING;
END;
$func$;

REVOKE ALL ON FUNCTION public.sso_jit_provision() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sso_jit_provision() TO authenticated;
