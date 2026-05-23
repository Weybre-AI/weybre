-- Security hardening: subscription self-upgrade, credit ledger, SSO domain probe

-- 1. Users must not UPDATE their own subscription (plan/status/credits) from the client.
DROP POLICY IF EXISTS "subs_update_own" ON public.subscriptions;

-- 2. Credit ledger rows only via SECURITY DEFINER RPCs (service_role / deduct_credits).
DROP POLICY IF EXISTS credit_tx_insert_own ON public.credit_transactions;

-- 3. SSO org lookup: authenticated only (no anonymous domain enumeration).
REVOKE ALL ON FUNCTION public.org_sso_for_domain(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_sso_for_domain(text) TO authenticated;

-- 4. SSO JIT: only for verified SSO/OAuth sign-ins, not password email signup.
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

  -- Skip password / magic-link sign-ins (domain-only join is unsafe).
  IF v_amr ILIKE '%password%' OR v_amr ILIKE '%otp%' OR v_amr ILIKE '%email%' THEN
    RETURN;
  END IF;
  IF v_provider IN ('email', '') AND v_amr NOT ILIKE '%sso%' AND v_amr NOT ILIKE '%oauth%' THEN
    RETURN;
  END IF;

  v_domain := lower(split_part(v_email, '@', 2));

  SELECT o.id, o.name, s.default_role, s.role_mappings
    INTO v_org
    FROM public.organization_sso s
    JOIN public.organizations o ON o.id = s.organization_id
   WHERE lower(s.email_domain) = v_domain
     AND s.is_enabled = true
   LIMIT 1;

  IF v_org.id IS NULL THEN RETURN; END IF;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org.id, v_uid, COALESCE(v_org.default_role, 'member'))
  ON CONFLICT (organization_id, user_id) DO NOTHING;
END;
$func$;
