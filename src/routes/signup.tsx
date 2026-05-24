import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { LogoLockup } from "@/components/Logo";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
  head: () => ({ meta: [{ title: "Create account — ContractIQ SA" }] }),
});

function SignupPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin + "/dashboard",
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Check your email to verify your account");
    navigate({ to: "/login" });
  }

  async function handleGoogle() {
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/dashboard" });
    if (res.error) toast.error(res.error.message || "Google sign-in failed");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16 bg-background relative">
      <div className="absolute inset-0 hero-glow pointer-events-none" />
      <div className="relative w-full max-w-md surface-card p-9">
        <div className="text-center mb-7">
          <div className="inline-block mb-3"><LogoLockup /></div>
          <h1 className="text-2xl font-extrabold">Start your free trial</h1>
          <p className="text-sm text-muted-foreground mt-1">14 days · 50 credits · No card required</p>
        </div>

        <button onClick={handleGoogle} className="w-full mb-5 py-3 rounded-xl border border-border hover:border-brand-blue text-sm font-medium transition-colors">
          Continue with Google
        </button>

        <div className="flex items-center gap-3 mb-5 text-xs text-muted-foreground">
          <div className="flex-1 h-px bg-border" /> OR <div className="flex-1 h-px bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">Full name</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm focus:border-brand-blue outline-none" />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm focus:border-brand-blue outline-none" />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm focus:border-brand-blue outline-none" />
          </div>
          <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-display font-bold text-sm glow-blue-soft hover:glow-blue transition-all disabled:opacity-50">
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account? <Link to="/login" className="text-brand-blue hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
