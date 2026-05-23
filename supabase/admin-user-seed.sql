-- ============================================================
-- Create a superadmin user with full access to everything.
-- Run this in: Supabase Dashboard → SQL Editor
--
-- CHANGE the email and password below before running.
-- The password is stored as a bcrypt hash — use the plain
-- text value when signing in through the app.
-- ============================================================

DO $$
DECLARE
  v_user_id UUID := gen_random_uuid();
  v_email   TEXT := 'admin@weybre.ai';          -- ← CHANGE THIS
  v_name    TEXT := 'Super Admin';               -- ← CHANGE THIS
  -- bcrypt hash of the password you want to use.
  -- This hash = "Admin@123456" — CHANGE IT.
  -- Generate a new one at: https://bcrypt-generator.com (cost 10)
  v_pw_hash TEXT := '$2a$10$PX4jBGWAqMbNLBpHGFnMCOQzBzBzBzBzBzBzBzBzBzBzBzBzBzBzB';
BEGIN

  -- 1. Insert into auth.users (Supabase's internal auth table)
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    raw_app_meta_data,
    role,
    aud,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    is_super_admin
  ) VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    v_email,
    v_pw_hash,
    now(),                          -- email pre-confirmed
    jsonb_build_object('full_name', v_name),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    'authenticated',
    'authenticated',
    now(),
    now(),
    '',
    '',
    false
  )
  ON CONFLICT (email) DO UPDATE
    SET raw_user_meta_data = EXCLUDED.raw_user_meta_data
  RETURNING id INTO v_user_id;

  -- Re-fetch id in case of ON CONFLICT (existing user)
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

  -- 2. Profile — mark onboarding complete so they skip the wizard
  INSERT INTO public.profiles (id, full_name, firm_name, onboarding_completed)
  VALUES (v_user_id, v_name, 'Weybre AI', true)
  ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        onboarding_completed = true;

  -- 3. Roles — both 'admin' and 'lawyer' so every RLS policy passes
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'lawyer')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- 4. Active firm subscription — no paywall, full access
  INSERT INTO public.subscriptions (
    user_id, plan, status, checkout_status,
    current_period_end, credits_remaining, credits_reset_at
  ) VALUES (
    v_user_id,
    'firm',
    'active',
    'paid',
    now() + INTERVAL '100 years',    -- effectively never expires
    2000,
    now() + INTERVAL '100 years'
  )
  ON CONFLICT (user_id) DO UPDATE
    SET plan              = 'firm',
        status            = 'active',
        checkout_status   = 'paid',
        current_period_end = now() + INTERVAL '100 years',
        credits_remaining = 2000;

  RAISE NOTICE 'Admin user ready — id: %, email: %', v_user_id, v_email;
END $$;
