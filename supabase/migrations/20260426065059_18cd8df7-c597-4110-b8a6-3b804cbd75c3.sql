CREATE TABLE IF NOT EXISTS public.billing_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan plan_tier NOT NULL UNIQUE,
  provider text NOT NULL DEFAULT 'razorpay',
  provider_plan_id text NOT NULL,
  amount integer NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  interval text NOT NULL DEFAULT 'monthly',
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_plans_select_active ON public.billing_plans;
CREATE POLICY billing_plans_select_active
ON public.billing_plans
FOR SELECT
TO authenticated
USING (active = true OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS billing_plans_admin_all ON public.billing_plans;
CREATE POLICY billing_plans_admin_all
ON public.billing_plans
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS update_billing_plans_updated_at ON public.billing_plans;
CREATE TRIGGER update_billing_plans_updated_at
BEFORE UPDATE ON public.billing_plans
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_billing_plans_provider_plan_id ON public.billing_plans(provider_plan_id);