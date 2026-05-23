
-- Roles
CREATE TYPE public.org_role AS ENUM ('owner', 'admin', 'member');

-- Organizations
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  plan text NOT NULL DEFAULT 'solo',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Members
CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.org_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
CREATE INDEX idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX idx_org_members_org ON public.organization_members(organization_id);

-- Invites
CREATE TABLE public.organization_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.org_role NOT NULL DEFAULT 'member',
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  invited_by uuid NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_org_invites_email ON public.organization_invites(lower(email));
CREATE INDEX idx_org_invites_org ON public.organization_invites(organization_id);

-- Helper functions (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_org_member(_org uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org AND user_id = _user
  );
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_org uuid, _user uuid, _min public.org_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org
      AND user_id = _user
      AND CASE _min
            WHEN 'member' THEN role IN ('owner','admin','member')
            WHEN 'admin'  THEN role IN ('owner','admin')
            WHEN 'owner'  THEN role = 'owner'
          END
  );
$$;

-- Enable RLS
ALTER TABLE public.organizations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invites  ENABLE ROW LEVEL SECURITY;

-- organizations policies
CREATE POLICY orgs_select_member ON public.organizations FOR SELECT TO authenticated
  USING (public.is_org_member(id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY orgs_insert_creator ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY orgs_update_admin ON public.organizations FOR UPDATE TO authenticated
  USING (public.has_org_role(id, auth.uid(), 'admin'))
  WITH CHECK (public.has_org_role(id, auth.uid(), 'admin'));
CREATE POLICY orgs_delete_owner ON public.organizations FOR DELETE TO authenticated
  USING (public.has_org_role(id, auth.uid(), 'owner'));

-- organization_members policies
CREATE POLICY members_select_same_org ON public.organization_members FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY members_insert_admin ON public.organization_members FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'));
CREATE POLICY members_update_admin ON public.organization_members FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'));
CREATE POLICY members_delete_admin_or_self ON public.organization_members FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin') OR user_id = auth.uid());

-- organization_invites policies
CREATE POLICY invites_select_admin ON public.organization_invites FOR SELECT TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'));
CREATE POLICY invites_insert_admin ON public.organization_invites FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin') AND invited_by = auth.uid());
CREATE POLICY invites_delete_admin ON public.organization_invites FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'));

-- Auto-add creator as owner
CREATE OR REPLACE FUNCTION public.handle_new_organization()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner');
  RETURN NEW;
END $$;

CREATE TRIGGER on_org_created
AFTER INSERT ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.handle_new_organization();

CREATE TRIGGER update_organizations_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Accept-invite RPC: matches by email, validates expiry, joins user
CREATE OR REPLACE FUNCTION public.accept_organization_invite(_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_invite public.organization_invites%ROWTYPE;
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  SELECT * INTO v_invite FROM public.organization_invites WHERE token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invite not found'; END IF;
  IF v_invite.accepted_at IS NOT NULL THEN RAISE EXCEPTION 'Invite already accepted'; END IF;
  IF v_invite.expires_at < now() THEN RAISE EXCEPTION 'Invite expired'; END IF;
  IF lower(v_invite.email) <> lower(v_email) THEN RAISE EXCEPTION 'This invite is for a different email'; END IF;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_invite.organization_id, auth.uid(), v_invite.role)
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  UPDATE public.organization_invites SET accepted_at = now() WHERE id = v_invite.id;
  RETURN v_invite.organization_id;
END $$;
