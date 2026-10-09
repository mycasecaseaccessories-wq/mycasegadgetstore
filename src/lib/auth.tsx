import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Ctx = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

const AuthContext = createContext<Ctx>({ session: null, user: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let unsubscribe = () => {};
    try {
      const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
        if (mounted) {
          // Keep the last usable session during transient refresh/network failures.
          // Only an explicit Supabase SIGNED_OUT event should clear it.
          setSession((currentSession) =>
            nextSession || event === "SIGNED_OUT" ? nextSession : currentSession,
          );
          setLoading(false);
        }
      });
      unsubscribe = () => sub.subscription.unsubscribe();
      Promise.race([
        supabase.auth.getSession(),
        new Promise<never>((_, reject) =>
          window.setTimeout(() => reject(new Error("Session restore timed out")), 30000),
        ),
      ])
        .then(({ data }) => {
          if (mounted && data.session) setSession(data.session);
        })
        .catch((error) => {
          console.error("Unable to restore the current session", error);
          // Do not discard a previously restored session because of a temporary
          // network timeout. Supabase will retry token refresh automatically.
        })
        .finally(() => {
          if (mounted) setLoading(false);
        });
    } catch (error) {
      console.error("Supabase authentication is unavailable", error);
      if (mounted) {
        setSession(null);
        setLoading(false);
      }
    }
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

export const signOut = () => supabase.auth.signOut();
