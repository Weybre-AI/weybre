
-- 1. user_roles: prevent privilege escalation
CREATE POLICY "user_roles_admin_insert" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "user_roles_admin_update" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "user_roles_admin_delete" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. usage_events: users insert only their own
CREATE POLICY "usage_events_insert_own" ON public.usage_events
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 3. organization_invites: invitee can see their own invite
CREATE POLICY "invites_select_invitee" ON public.organization_invites
  FOR SELECT TO authenticated
  USING (lower(email) = lower((SELECT u.email FROM auth.users u WHERE u.id = auth.uid())));

-- 4. Revoke execute on SECURITY DEFINER helpers from anon (and signed-in where internal-only)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, org_role) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_organization() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.judgments_tsv_trigger() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.accept_organization_invite(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.search_judgments(text, extensions.vector, integer) FROM anon;
