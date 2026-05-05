import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const Auth = () => {
  const nav = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const redirect = `${window.location.origin}/`;
        const { error } = await supabase.auth.signUp({
          email, password, options: { emailRedirectTo: redirect },
        });
        if (error) throw error;
        toast.success("Check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        nav("/");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm border border-border bg-surface/40 p-6">
        <Link to="/" className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground">
          ← Dashboard
        </Link>
        <h1 className="mt-3 text-lg font-semibold tracking-tight">
          {mode === "signin" ? "Sign in" : "Create account"}
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {mode === "signin" ? "Access your watchlist." : "We'll email a confirmation link."}
        </p>

        <form onSubmit={submit} className="mt-5 space-y-3">
          <div>
            <Label htmlFor="email" className="text-[10px] uppercase tracking-wider">Email</Label>
            <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="password" className="text-[10px] uppercase tracking-wider">Password</Label>
            <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={6} required />
          </div>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "..." : mode === "signin" ? "Sign in" : "Sign up"}
          </Button>
        </form>

        <button
          onClick={() => setMode(m => m === "signin" ? "signup" : "signin")}
          className="mt-4 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
        </button>
      </div>
    </main>
  );
};

export default Auth;
