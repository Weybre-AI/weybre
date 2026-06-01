import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "./Logo";

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const { isActive, loading: subLoading } = useSubscription();
  const location = useLocation();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) {
      setOnboardingDone(null);
      return;
    }
    let cancelled = false;
    supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setOnboardingDone(data?.onboarding_completed ?? false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (authLoading || subLoading || (user && onboardingDone === null)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-hero">
        <div className="flex flex-col items-center gap-6">
          <Logo className="h-10 w-auto animate-pulse" />
          <div className="text-center">
            <div className="font-serif text-lg font-medium text-primary">Preparing your workspace</div>
            <div className="mt-4 h-1 w-48 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-full origin-left animate-progress-loading rounded-full bg-accent" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location.pathname }} replace />;
  }

  if (location.pathname !== "/onboarding" && onboardingDone === false) {
    return <Navigate to="/onboarding" replace />;
  }

  if (onboardingDone && !isActive) {
    return <Navigate to="/pricing" replace />;
  }

  return <>{children}</>;
};
