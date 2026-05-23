
CREATE TABLE public.organization_sso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('google_workspace','saml')),
  email_domain text NOT NULL,
  sso_provider_id text,
  default_role org_role NOT NULL DEFAULT 'member',
  role_mappings jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uniq_org_sso_domain ON public.organization_sso (lower(email_domain)) WHERE is_active;

ALTER TABLE public.organization_sso ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_sso_select_member" ON public.organization_sso
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "org_sso_write_admin" ON public.organization_sso
  FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'));

CREATE TRIGGER trg_org_sso_updated_at
BEFORE UPDATE ON public.organization_sso
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Domain-to-org lookup callable from the sign-in page (no auth required)
CREATE OR REPLACE FUNCTION public.org_sso_for_domain(_domain text)
RETURNS TABLE (
  organization_id uuid, organization_name text, provider text,
  sso_provider_id text, email_domain text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.organization_id, o.name, s.provider, s.sso_provider_id, s.email_domain
  FROM public.organization_sso s
  JOIN public.organizations o ON o.id = s.organization_id
  WHERE lower(s.email_domain) = lower(_domain) AND s.is_active
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.org_sso_for_domain(text) TO anon, authenticated;

-- JIT provisioning: called from app after sign-in
CREATE OR REPLACE FUNCTION public.sso_jit_provision()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_email text;
  v_domain text;
  v_sso public.organization_sso%ROWTYPE;
  v_role org_role;
BEGIN
  IF v_user IS NULL THEN RETURN NULL; END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = v_user;
  IF v_email IS NULL OR position('@' in v_email) = 0 THEN RETURN NULL; END IF;
  v_domain := lower(split_part(v_email, '@', 2));

  SELECT * INTO v_sso FROM public.organization_sso
   WHERE lower(email_domain) = v_domain AND is_active LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  v_role := v_sso.default_role;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_sso.organization_id, v_user, v_role)
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  PERFORM public.log_audit_event(
    v_sso.organization_id, 'sso.jit_provisioned', 'member', v_user::text,
    jsonb_build_object('email', v_email, 'provider', v_sso.provider, 'role', v_role)
  );

  RETURN v_sso.organization_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.sso_jit_provision() FROM anon;
GRANT EXECUTE ON FUNCTION public.sso_jit_provision() TO authenticated;
