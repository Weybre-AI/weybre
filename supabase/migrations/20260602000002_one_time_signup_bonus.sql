-- Update billing_plans to include a 'trial' plan with 0 monthly credits.
-- This ensures that users on the trial plan don't get recurring free credits.

INSERT INTO public.billing_plans (id, display_name, price_inr, seats, credits_month, sort_order, is_active, features)
VALUES (
  'trial', 
  'Free Trial', 
  0, 
  1, 
  0, 
  0, 
  false, 
  '["10 one-time signup credits","Limited access"]'::jsonb
)
ON CONFLICT (id) DO UPDATE SET 
  credits_month = EXCLUDED.credits_month,
  is_active = EXCLUDED.is_active;

-- Update handle_new_user to use the 'trial' plan and grant 10 one-time credits.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  -- 1. Create Profile
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  -- 2. Grant default App Role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'lawyer')
  ON CONFLICT DO NOTHING;

  -- 3. Provision ONE-TIME trial credits
  -- We set plan to 'trial' which has 0 credits_month, so resets won't add more.
  -- credits_reset_at is set to a far future date to prevent accidental resets 
  -- by the monthly cron, or we can set it to NULL if the reset logic handles it.
  INSERT INTO public.subscriptions (
    user_id, 
    plan, 
    status, 
    credits_remaining, 
    credits_reset_at
  )
  VALUES (
    NEW.id,
    'trial',
    'active',
    10,
    NULL
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$func$;

-- Update the monthly reset logic to EXCLUDE 'trial' plan users or users with NULL reset_at.
-- This ensures their one-time bonus doesn't get wiped or topped up.
CREATE OR REPLACE FUNCTION public.reset_monthly_credits(_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_credits INTEGER;
  v_sub_id  UUID;
  v_plan    TEXT;
BEGIN
  SELECT s.id, bp.credits_month, s.plan::text
    INTO v_sub_id, v_credits, v_plan
    FROM public.subscriptions s
    JOIN public.billing_plans bp ON bp.id = s.plan::text
   WHERE s.user_id = _user_id
   LIMIT 1;

  IF v_sub_id IS NULL OR v_plan = 'trial' THEN RETURN; END IF;

  UPDATE public.subscriptions
     SET credits_remaining = v_credits,
         credits_reset_at  = now() + INTERVAL '1 month'
   WHERE id = v_sub_id;

  INSERT INTO public.credit_transactions
    (user_id, subscription_id, amount, balance_after, reason)
  VALUES
    (_user_id, v_sub_id, v_credits, v_credits, 'monthly_reset');
END;
$func$;
