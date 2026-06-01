import { useEffect, useState, createContext, useContext, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listener FIRST, then getSession — required pattern.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setLoading(false);
      if (event === "SIGNED_IN" && s?.user) {
        // Fire-and-forget JIT provisioning: if user's email domain matches an org SSO config,
        // they're added as a member with the configured default role.
        setTimeout(() => {
          supabase.rpc("sso_jit_provision").then(({ error }) => {
            if (error) {
              console.warn("sso_jit_provision:", error.message);
              // Only toast if it's a real error, not just "no matching domain"
              if (!error.message.includes("no rows") && !error.message.includes("NULL")) {
                toast.error("SSO provisioning failed. Please contact your admin.");
              }
            } else {
              // Successfully provisioned
              toast.success("Welcome! You've been automatically added to your organization.");
            }
          });
        }, 0);
      }
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => { await supabase.auth.signOut(); };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
