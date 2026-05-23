-- ============================================================
-- New pricing model: Starter / Professional / Firm / Enterprise
-- Drop and recreate billing_plans cleanly, add credits system
-- ============================================================

-- 1. Extend plan_tier enum with new tiers (safe - IF NOT EXISTS)
DO $$ BEGIN
  ALTER TYPE public.plan_tier ADD VALUE IF NOT EXISTS 'starter';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.plan_tier ADD VALUE IF NOT EXISTS 'professional';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.plan_tier ADD VALUE IF NOT EXISTS 'enterprise';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Drop and recreate billing_plans cleanly
DROP TABLE IF EXISTS public.billing_plans CASCADE;

CREATE TABLE public.billing_plans (
  id            TEXT PRIMARY KEY,
  display_name  TEXT NOT NULL,
  price_inr     INTEGER NOT NULL DEFAULT 0,
  seats         INTEGER NOT NULL DEFAULT 1,
  credits_month INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  features      JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.billing_plans (id, display_name, price_inr, seats, credits_month, sort_order, features) VALUES
  ('starter',      'Starter',      1999,  1,   100,  1, '["100 AI credits/month","Case-law research","Contract drafting","Matter management","Export PDF/DOCX","GST invoices","Email support"]'::jsonb),
  ('professional', 'Professional', 4999,  1,   500,  2, '["500 AI credits/month","Everything in Starter","Litigation Intel + eCourts","Audit log","Priority support","SSO ready"]'::jsonb),
  ('firm',         'Firm',         14999, 5,   2000, 3, '["2,000 pooled credits/month","Up to 5 seats","Everything in Professional","Shared matters","Dedicated onboarding","SLA support"]'::jsonb),
  ('enterprise',   'Enterprise',   0,     999, 0,    4, '["Unlimited seats","Unlimited credits","API access","Custom integrations","Dedicated account manager","On-premise option"]'::jsonb);

ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_plans_public_read ON public.billing_plans;
CREATE POLICY billing_plans_public_read ON public.billing_plans
  FOR SELECT TO anon, authenticated USING (is_active = true);

DROP POLICY IF EXISTS billing_plans_admin_write ON public.billing_plans;
CREATE POLICY billing_plans_admin_write ON public.billing_plans
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Add credits columns to subscriptions (safe)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS credits_remaining  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credits_reset_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS seats_used         INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS dodo_customer_id   TEXT,
  ADD COLUMN IF NOT EXISTS dodo_payment_id    TEXT;

-- 4. Credit transactions log
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  amount          INTEGER NOT NULL,
  balance_after   INTEGER NOT NULL,
  reason          TEXT NOT NULL,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS credit_tx_select_own ON public.credit_transactions;
CREATE POLICY credit_tx_select_own ON public.credit_transactions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS credit_tx_insert_own ON public.credit_transactions;
CREATE POLICY credit_tx_insert_own ON public.credit_transactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_credit_tx_user ON public.credit_transactions(user_id, created_at DESC);

-- 5. Credit costs per action
CREATE TABLE IF NOT EXISTS public.credit_costs (
  action      TEXT PRIMARY KEY,
  credits     INTEGER NOT NULL,
  description TEXT
);

INSERT INTO public.credit_costs (action, credits, description) VALUES
  ('research_query',    1, 'Case-law or web research query'),
  ('contract_analysis', 3, 'Contract intake & clause extraction'),
  ('litigation_brief',  2, 'Litigation intelligence brief'),
  ('draft_generation',  1, 'Contract/document draft generation'),
  ('decision_engine',   2, 'Legal decision engine query'),
  ('vision_ocr',        1, 'OCR page extraction')
ON CONFLICT (action) DO UPDATE SET credits = EXCLUDED.credits;

ALTER TABLE public.credit_costs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS credit_costs_read ON public.credit_costs;
CREATE POLICY credit_costs_read ON public.credit_costs FOR SELECT TO authenticated USING (true);

-- 6. Atomic credit deduction function
CREATE OR REPLACE FUNCTION public.deduct_credits(
  _user_id UUID,
  _action  TEXT,
  _metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_cost     INTEGER;
  v_sub_id   UUID;
  v_balance  INTEGER;
  v_new_bal  INTEGER;
  v_plan     TEXT;
BEGIN
  SELECT credits INTO v_cost FROM public.credit_costs WHERE action = _action;
  IF v_cost IS NULL THEN v_cost := 1; END IF;

  SELECT id, credits_remaining, plan::text
    INTO v_sub_id, v_balance, v_plan
    FROM public.subscriptions
   WHERE user_id = _user_id AND status = 'active'
   LIMIT 1;

  IF v_plan = 'enterprise' THEN RETURN 9999; END IF;
  IF v_sub_id IS NULL THEN RETURN -1; END IF;
  IF v_balance < v_cost THEN RETURN -1; END IF;

  v_new_bal := v_balance - v_cost;

  UPDATE public.subscriptions
     SET credits_remaining = v_new_bal
   WHERE id = v_sub_id;

  INSERT INTO public.credit_transactions
    (user_id, subscription_id, amount, balance_after, reason, metadata)
  VALUES
    (_user_id, v_sub_id, -v_cost, v_new_bal, _action, _metadata);

  RETURN v_new_bal;
END;
$func$;

REVOKE ALL ON FUNCTION public.deduct_credits(uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deduct_credits(uuid, text, jsonb) TO authenticated, service_role;

-- 7. Monthly credit reset function
CREATE OR REPLACE FUNCTION public.reset_monthly_credits(_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_credits INTEGER;
  v_sub_id  UUID;
BEGIN
  SELECT s.id, bp.credits_month
    INTO v_sub_id, v_credits
    FROM public.subscriptions s
    JOIN public.billing_plans bp ON bp.id = s.plan::text
   WHERE s.user_id = _user_id
   LIMIT 1;

  IF v_sub_id IS NULL THEN RETURN; END IF;

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

REVOKE ALL ON FUNCTION public.reset_monthly_credits(uuid) FROM PUBLIC, anon, authenticated;

-- 8. Update handle_new_user to default to starter
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'lawyer')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.subscriptions (user_id, plan, status, credits_remaining, credits_reset_at)
  VALUES (NEW.id, 'starter', 'active', 100, now() + INTERVAL '30 days')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$func$;
