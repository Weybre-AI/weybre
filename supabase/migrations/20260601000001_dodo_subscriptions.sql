-- Set up subscriptions table based on Dodo Payments
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  provider_id text NOT NULL UNIQUE,
  plan text NOT NULL,
  status text NOT NULL,
  current_period_end timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS provider_id text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'subscriptions'
      AND indexname = 'subscriptions_provider_id_idx'
  ) THEN
    CREATE UNIQUE INDEX subscriptions_provider_id_idx ON public.subscriptions(provider_id);
  END IF;
END;
$$;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION handle_subscription_update()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'active' THEN
    UPDATE public.profiles SET role = 'pro' WHERE id = NEW.user_id;
  ELSIF NEW.status = 'cancelled' THEN
    UPDATE public.profiles SET role = 'free' WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists to avoid errors on reruns
DROP TRIGGER IF EXISTS on_subscription_update ON public.subscriptions;
CREATE TRIGGER on_subscription_update
  AFTER INSERT OR UPDATE OF status ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION handle_subscription_update();
