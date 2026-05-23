
-- Fix subscriptions RLS: allow users to insert/update their own subscription rows.
-- The signup trigger runs as SECURITY DEFINER so it bypasses RLS, but the user-facing
-- "start trial" upsert from Pricing page needs INSERT + UPDATE policies.

CREATE POLICY "subs_insert_own"
  ON public.subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "subs_update_own"
  ON public.subscriptions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Ensure updated_at trigger exists on subscriptions
DROP TRIGGER IF EXISTS subscriptions_set_updated_at ON public.subscriptions;
CREATE TRIGGER subscriptions_set_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
