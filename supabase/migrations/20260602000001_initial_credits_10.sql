-- Every new signup must have 10 credits so they can explore the platform.
-- This updates the handle_new_user trigger to grant exactly 10 credits initially.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_initial_credits INTEGER := 10;
BEGIN
  -- 1. Create Profile
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  -- 2. Grant default App Role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'lawyer')
  ON CONFLICT DO NOTHING;

  -- 3. Provision trial subscription with 10 exploration credits
  -- We use 'starter' plan as the base for the trial.
  INSERT INTO public.subscriptions (
    user_id, 
    plan, 
    status, 
    credits_remaining, 
    credits_reset_at
  )
  VALUES (
    NEW.id,
    'starter',
    'active',
    v_initial_credits,
    now() + INTERVAL '30 days'
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$func$;
