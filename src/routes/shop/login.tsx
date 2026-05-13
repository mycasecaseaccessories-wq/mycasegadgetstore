import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

export const Route = createFileRoute("/shop/login")({ component: LoginPage });

function LoginPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/shop/reset-password`,
        });
        if (error) throw error;
        toast.success("Password reset email sent. Check your inbox.");
        setMode("signin");
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/shop/account`,
            data: { full_name: name },
          },
        });
        if (error) throw error;
        toast.success("Check your email to verify your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Signed in");
        nav({ to: "/shop/account" });
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/shop/account`,
      });
      if (result.error) throw new Error(String((result.error as any)?.message ?? result.error));
      if (!result.redirected) nav({ to: "/shop/account" });
    } catch (e: any) {
      toast.error(e?.message ?? "Google sign-in failed");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-md items-center px-4 py-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/shop"><ArrowLeft className="mr-2 h-4 w-4" />Back to shop</Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 py-8">
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold">
                {mode === "signin" ? "Welcome back" : mode === "signup" ? "Create account" : "Reset password"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {mode === "signin"
                  ? "Sign in to track orders & loyalty points"
                  : mode === "signup"
                  ? "Sign up to save your orders & earn points"
                  : "Enter your email to receive a reset link"}
              </p>
            </div>

            {mode !== "forgot" && (
              <>
                <Button type="button" variant="outline" className="w-full" onClick={google} disabled={busy}>
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.32z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.93l3.66-2.83z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
                  Continue with Google
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">or</span></div>
                </div>
              </>
            )}

            <form onSubmit={submit} className="space-y-3">
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input id="email" type="email" className="pl-9" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
              </div>
              {mode !== "forgot" && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    {mode === "signin" && (
                      <button type="button" onClick={() => setMode("forgot")} className="text-xs font-medium text-primary hover:underline">
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input id="password" type="password" className="pl-9" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                  </div>
                </div>
              )}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Please wait…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground">
              {mode === "forgot" ? (
                <button type="button" onClick={() => setMode("signin")} className="font-medium text-primary hover:underline">
                  Back to sign in
                </button>
              ) : (
                <>
                  {mode === "signin" ? "Don't have an account?" : "Already have an account?"}{" "}
                  <button
                    type="button"
                    onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                    className="font-medium text-primary hover:underline"
                  >
                    {mode === "signin" ? "Sign up" : "Sign in"}
                  </button>
                </>
              )}
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
