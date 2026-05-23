import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "./Logo";

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
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
  }, [user?.id]);

  if (loading || (user && onboardingDone === null)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-hero">
        <div className="flex flex-col items-center gap-4">
          <Logo showWordmark={false} />
          <div className="h-1 w-32 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-accent" />
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

  return <>{children}</>;
};
