import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Sparkles, Loader2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!loading && session) return <Navigate to="/dashboard" replace />;

  const onLogin = async (e: FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      toast.error("Email and password are required");
      return;
    }
    setBusy(true);
    try {
      const result = await Promise.race([
        supabase.auth.signInWithPassword({ email: normalizedEmail, password }),
        new Promise<never>((_, reject) =>
          window.setTimeout(() => reject(new Error("Sign in timed out. Please try again.")), 15000),
        ),
      ]);
      if (result.error) {
        const message = result.error.message.toLowerCase().includes("invalid login credentials")
          ? "Email သို့မဟုတ် password မှားနေပါသည်။ ပြန်စစ်ပြီး ထပ်ဝင်ပါ။"
          : result.error.message;
        toast.error(message);
        return;
      }
      void logActivity({ action: "auth.login", summary: `Signed in as ${normalizedEmail}` });
      toast.success("Welcome back");
      await navigate({ to: "/dashboard" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div className="absolute inset-0 -z-10 opacity-50">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-primary/30 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-accent/30 blur-3xl" />
      </div>

      <div className="w-full max-w-md rounded-2xl border bg-card/80 p-8 shadow-2xl backdrop-blur">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-md">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold leading-tight">My Case</h1>
            <p className="text-xs text-muted-foreground">Admin Console</p>
          </div>
        </div>

        <form onSubmit={onLogin} autoComplete="on" className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-11"
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Sign in
          </Button>
          <a
            href="/shop/login"
            className="flex items-center justify-center gap-1 text-center text-xs font-medium text-primary hover:underline"
          >
            <KeyRound className="h-3.5 w-3.5" /> Forgot password? Reset from account sign-in
          </a>
          <p className="text-center text-xs text-muted-foreground">
            Staff အသစ်ထည့်ရန် admin သည် Team စာမျက်နှာမှသာ ဖိတ်ခေါ်နိုင်ပါသည်။
          </p>
        </form>
      </div>
    </div>
  );
}
