
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_user_id uuid,
  actor_email text,
  action text NOT NULL,
  resource_type text,
  resource_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_org_created ON public.audit_logs (organization_id, created_at DESC);
CREATE INDEX idx_audit_logs_actor ON public.audit_logs (actor_user_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs (action);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only org admins/owners can read
CREATE POLICY "audit_logs_select_admin" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'::org_role)
         OR public.has_role(auth.uid(), 'admin'::app_role));

-- No direct insert/update/delete from clients; only via the security-definer function below.

-- Secure logger
CREATE OR REPLACE FUNCTION public.log_audit_event(
  _org uuid,
  _action text,
  _resource_type text DEFAULT NULL,
  _resource_id text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_actor uuid := auth.uid();
  v_email text;
BEGIN
  IF v_actor IS NOT NULL THEN
    SELECT email INTO v_email FROM auth.users WHERE id = v_actor;
  END IF;
  INSERT INTO public.audit_logs (organization_id, actor_user_id, actor_email, action, resource_type, resource_id, metadata)
  VALUES (_org, v_actor, v_email, _action, _resource_type, _resource_id, COALESCE(_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.log_audit_event(uuid, text, text, text, jsonb) FROM anon;
-- authenticated can call (e.g., from the app for data-access events), still write-only

-- Trigger on members
CREATE OR REPLACE FUNCTION public.tg_audit_members()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_audit_event(NEW.organization_id, 'member.added', 'member', NEW.id::text,
      jsonb_build_object('user_id', NEW.user_id, 'role', NEW.role));
  ELSIF TG_OP = 'UPDATE' AND OLD.role IS DISTINCT FROM NEW.role THEN
    PERFORM public.log_audit_event(NEW.organization_id, 'member.role_changed', 'member', NEW.id::text,
      jsonb_build_object('user_id', NEW.user_id, 'from', OLD.role, 'to', NEW.role));
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_audit_event(OLD.organization_id, 'member.removed', 'member', OLD.id::text,
      jsonb_build_object('user_id', OLD.user_id, 'role', OLD.role));
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

REVOKE EXECUTE ON FUNCTION public.tg_audit_members() FROM anon, authenticated, public;

CREATE TRIGGER trg_audit_members
AFTER INSERT OR UPDATE OR DELETE ON public.organization_members
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_members();

-- Trigger on invites
CREATE OR REPLACE FUNCTION public.tg_audit_invites()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_audit_event(NEW.organization_id, 'invite.created', 'invite', NEW.id::text,
      jsonb_build_object('email', NEW.email, 'role', NEW.role));
  ELSIF TG_OP = 'UPDATE' AND OLD.accepted_at IS NULL AND NEW.accepted_at IS NOT NULL THEN
    PERFORM public.log_audit_event(NEW.organization_id, 'invite.accepted', 'invite', NEW.id::text,
      jsonb_build_object('email', NEW.email));
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_audit_event(OLD.organization_id, 'invite.revoked', 'invite', OLD.id::text,
      jsonb_build_object('email', OLD.email));
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

REVOKE EXECUTE ON FUNCTION public.tg_audit_invites() FROM anon, authenticated, public;

CREATE TRIGGER trg_audit_invites
AFTER INSERT OR UPDATE OR DELETE ON public.organization_invites
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_invites();
