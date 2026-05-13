import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { User, LogIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function ShopAccountButton() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <Link
      to={signedIn ? "/shop/account" : "/shop/login"}
      className="inline-flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium hover:bg-accent"
    >
      {signedIn ? <User className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
      <span className="hidden sm:inline">{signedIn ? "Account" : "Sign in"}</span>
    </Link>
  );
}
