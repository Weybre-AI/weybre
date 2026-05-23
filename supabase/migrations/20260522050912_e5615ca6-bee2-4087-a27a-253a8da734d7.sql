-- Enhance sso_jit_provision to honor per-org role_mappings from JWT app_metadata.
-- IdPs send groups via custom SAML attributes (e.g. "groups": ["legal-admins"])
-- which Supabase mirrors into raw_app_meta_data. We map the first matching group
-- → org_role, falling back to organization_sso.default_role.

CREATE OR REPLACE FUNCTION public.sso_jit_provision()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_email text;
  v_domain text;
  v_sso public.organization_sso%ROWTYPE;
  v_role org_role;
  v_app_meta jsonb;
  v_groups jsonb;
  v_group text;
  v_mapped text;
BEGIN
  IF v_user IS NULL THEN RETURN NULL; END IF;

  SELECT email, raw_app_meta_data
    INTO v_email, v_app_meta
    FROM auth.users WHERE id = v_user;
  IF v_email IS NULL OR position('@' in v_email) = 0 THEN RETURN NULL; END IF;
  v_domain := lower(split_part(v_email, '@', 2));

  SELECT * INTO v_sso FROM public.organization_sso
   WHERE lower(email_domain) = v_domain AND is_active LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  v_role := v_sso.default_role;

  -- Role mapping: walk IdP-supplied groups, pick the highest-priority mapping.
  -- role_mappings shape: {"legal-admins":"admin","partners":"owner"}
  v_groups := COALESCE(v_app_meta->'groups', v_app_meta->'roles', '[]'::jsonb);
  IF jsonb_typeof(v_groups) = 'array' AND v_sso.role_mappings IS NOT NULL THEN
    FOR v_group IN SELECT jsonb_array_elements_text(v_groups) LOOP
      v_mapped := v_sso.role_mappings ->> v_group;
      IF v_mapped IN ('owner','admin','member') THEN
        -- pick most privileged across mapped groups
        IF v_mapped = 'owner' OR (v_mapped = 'admin' AND v_role <> 'owner') THEN
          v_role := v_mapped::org_role;
        END IF;
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_sso.organization_id, v_user, v_role)
  ON CONFLICT (organization_id, user_id)
    DO UPDATE SET role = EXCLUDED.role
    WHERE public.organization_members.role <> 'owner';

  PERFORM public.log_audit_event(
    v_sso.organization_id, 'sso.jit_provisioned', 'member', v_user::text,
    jsonb_build_object('email', v_email, 'provider', v_sso.provider, 'role', v_role, 'groups', v_groups)
  );

  RETURN v_sso.organization_id;
END $function$;

-- Lock down: only authenticated users may call.
REVOKE ALL ON FUNCTION public.sso_jit_provision() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sso_jit_provision() TO authenticated;