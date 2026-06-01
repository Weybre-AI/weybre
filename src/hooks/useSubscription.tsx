import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { useIsAdmin } from "./useIsAdmin";
import { supabase } from "@/integrations/supabase/client";

export type SubStatus = "active" | "past_due" | "cancelled" | "incomplete";
export type PlanTier = "starter" | "professional" | "firm" | "enterprise" | "solo";

export interface Subscription {
  plan: PlanTier;
  status: SubStatus;
  current_period_end: string | null;
  checkout_status?: string | null;
  dodo_subscription_id?: string | null;
  credits_remaining: number;
  credits_reset_at: string | null;
  seats_used: number;
}

export const PLAN_CREDITS: Record<string, number> = {
  starter: 100,
  professional: 500,
  firm: 2000,
  enterprise: 0, // unlimited
  solo: 500,     // legacy
};

export const PLAN_DISPLAY: Record<string, string> = {
  starter: "Starter",
  professional: "Professional",
  firm: "Firm",
  enterprise: "Enterprise",
  solo: "Solo (Legacy)",
};

export const useSubscription = () => {
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const [plans, setPlans] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("billing_plans").select("id, credits_month");
      if (data) setPlans(data.reduce((acc, p) => ({ ...acc, [p.id]: p.credits_month }), {}));
    })();
  }, []);

  useEffect(() => {
    if (!user) { setSub(null); setLoading(false); return; }
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("plan,status,current_period_end,checkout_status,dodo_subscription_id,credits_remaining,credits_reset_at,seats_used")
        .eq("user_id", user.id)
        .maybeSingle();
      if (active) { setSub(data as Subscription | null); setLoading(false); }
    })();
    return () => { active = false; };
  }, [user]);

  const isActive = isAdmin || sub?.status === "active";
  const isUnlimited = isAdmin || sub?.plan === "enterprise";
  const creditsRemaining = isUnlimited ? Infinity : (sub?.credits_remaining ?? 0);
  const totalCredits = isUnlimited ? Infinity : plans[sub?.plan ?? "starter"] ?? PLAN_CREDITS[sub?.plan ?? "starter"] ?? 100;
  const creditsPercent = isUnlimited ? 100 : Math.round((creditsRemaining / totalCredits) * 100);

  return { sub, loading: loading || adminLoading, isActive, isUnlimited, creditsRemaining, totalCredits, creditsPercent };
};
