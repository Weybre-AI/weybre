-- Edge functions call RPCs with the service_role key; grant EXECUTE after the
-- 20260521040936 lockdown migration revoked broad function access.

GRANT EXECUTE ON FUNCTION public.deduct_credits(uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.search_judgments(text, extensions.vector, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.reset_monthly_credits(uuid) TO service_role;

-- New signups: active trial with starter-plan credits (was incomplete + 0 → all AI calls failed).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_trial_credits INTEGER;
BEGIN
  SELECT credits_month INTO v_trial_credits
    FROM public.billing_plans
   WHERE id = 'starter'
   LIMIT 1;

  IF v_trial_credits IS NULL OR v_trial_credits < 1 THEN
    v_trial_credits := 25;
  END IF;

  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'lawyer')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.subscriptions (
    user_id, plan, status, credits_remaining, credits_reset_at
  )
  VALUES (
    NEW.id,
    'starter',
    'active',
    v_trial_credits,
    now() + INTERVAL '30 days'
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$func$;

-- Existing accounts stuck on incomplete / zero credits (dev + early users).
UPDATE public.subscriptions s
   SET status = 'active',
       credits_remaining = GREATEST(
         s.credits_remaining,
         COALESCE((SELECT bp.credits_month FROM public.billing_plans bp WHERE bp.id = 'starter'), 25)
       ),
       credits_reset_at = COALESCE(s.credits_reset_at, now() + INTERVAL '30 days')
 WHERE s.credits_remaining = 0;
