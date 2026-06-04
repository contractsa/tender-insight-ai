import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Upload, FileText, Sparkles, ArrowRight, Building2, Radar, CreditCard, Activity, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function profileCompleteness(p: any): { pct: number; missing: string[] } {
  if (!p) return { pct: 0, missing: ["legal_name", "registration_number", "vat_number", "business_structure", "cidb_grade", "bbbee_level"] };
  const required: [string, string][] = [
    ["legal_name", "Legal name"], ["registration_number", "Registration number"],
    ["vat_number", "VAT number"], ["business_structure", "Business structure"],
    ["cidb_grade", "CIDB grade"], ["bbbee_level", "B-BBEE level"],
  ];
  const missing = required.filter(([k]) => !p[k] || !String(p[k]).trim()).map(([, l]) => l);
  if (!Array.isArray(p.directors) || !p.directors.length) missing.push("Directors");
  if (!Array.isArray(p.capabilities) || !p.capabilities.length) missing.push("Capabilities");
  if (!Array.isArray(p.professional_registrations) || !p.professional_registrations.length) missing.push("Professional registrations");
  const total = required.length + 3;
  return { pct: Math.round(((total - missing.length) / total) * 100), missing };
}

function DashboardPage() {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("profiles").select("*").eq("user_id", user!.id).single()).data,
  });
  const { data: company } = useQuery({
    queryKey: ["company_profile", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("company_profiles").select("*").eq("user_id", user!.id).maybeSingle()).data,
  });
  const { data: docs } = useQuery({
    queryKey: ["recent-docs", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("documents").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: monitored } = useQuery({
    queryKey: ["monitored", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("monitored_tenders").select("*")).data ?? [],
  });

  const completeness = profileCompleteness(company);
  const now = Date.now();
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(now - 7 * 86400000);
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const list = docs ?? [];
  const thisMonth = list.filter((d: any) => new Date(d.created_at) >= monthStart);
  const thisWeek = list.filter((d: any) => new Date(d.created_at) >= weekStart);
  const today = list.filter((d: any) => new Date(d.created_at) >= todayStart);
  const closingSoon = (monitored ?? []).filter((t: any) => t.closing_date && new Date(t.closing_date).getTime() - now < 7 * 86400000 && new Date(t.closing_date).getTime() > now);
  const closing48 = (monitored ?? []).filter((t: any) => t.closing_date && new Date(t.closing_date).getTime() - now < 2 * 86400000 && new Date(t.closing_date).getTime() > now);

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold">Welcome back{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}</h1>
        <p className="text-muted-foreground mt-1">Upload a tender to extract structured insights in seconds.</p>
      </header>

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
        <Link to="/upload" className="surface-card p-3 text-center hover:border-brand-blue/40 transition-colors">
          <Upload className="w-5 h-5 mx-auto mb-1 text-brand-blue" /><div className="text-xs font-semibold">Upload</div>
        </Link>
        <Link to="/company-profile" className="surface-card p-3 text-center hover:border-brand-teal/40 transition-colors">
          <Building2 className="w-5 h-5 mx-auto mb-1 text-brand-teal" /><div className="text-xs font-semibold">Profile</div>
        </Link>
        <Link to="/monitoring" className="surface-card p-3 text-center hover:border-brand-blue/40 transition-colors">
          <Radar className="w-5 h-5 mx-auto mb-1 text-brand-blue" /><div className="text-xs font-semibold">Monitor</div>
        </Link>
        <Link to="/pricing" className="surface-card p-3 text-center hover:border-brand-gold/40 transition-colors">
          <CreditCard className="w-5 h-5 mx-auto mb-1 text-brand-gold" /><div className="text-xs font-semibold">Credits</div>
        </Link>
      </div>

      {/* Expansion cards */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        {/* Credits card */}
        <div className="surface-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Credits</h3>
            <CreditCard className="w-4 h-4 text-brand-gold" />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div><div className="text-2xl font-extrabold text-brand-blue">{profile?.credits_remaining ?? 0}</div><div className="text-xs text-muted-foreground">Remaining</div></div>
            <div><div className="text-2xl font-extrabold text-brand-teal">{Math.max(0, (profile?.credits_total ?? 0) - (profile?.credits_remaining ?? 0))}</div><div className="text-xs text-muted-foreground">Used this period</div></div>
          </div>
          <div className="w-full h-2 bg-surface-2 rounded-full mb-3 overflow-hidden">
            <div className="h-full bg-brand-blue" style={{ width: `${Math.round(((profile?.credits_remaining ?? 0) / Math.max(1, profile?.credits_total ?? 1)) * 100)}%` }} />
          </div>
          <Link to="/pricing" className="text-xs text-brand-blue hover:underline">Buy more credits →</Link>
        </div>

        {/* Activity */}
        <div className="surface-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Activity</h3>
            <Activity className="w-4 h-4 text-brand-teal" />
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3 text-center">
            <div><div className="text-xl font-extrabold">{thisMonth.length}</div><div className="text-[10px] text-muted-foreground">this month</div></div>
            <div><div className="text-xl font-extrabold">{thisWeek.length}</div><div className="text-[10px] text-muted-foreground">this week</div></div>
            <div><div className="text-xl font-extrabold">{today.length}</div><div className="text-[10px] text-muted-foreground">today</div></div>
          </div>
          {list.slice(0, 3).map((d: any) => (
            <Link key={d.id} to="/documents/$id" params={{ id: d.id }} className="flex items-center justify-between text-xs py-1 hover:text-brand-blue">
              <span className="truncate flex-1">{(d.file_name ?? "").slice(0, 40)}</span>
              <span className="text-muted-foreground ml-2 shrink-0">{new Date(d.created_at).toLocaleDateString()}</span>
            </Link>
          ))}
        </div>

        {/* Monitored */}
        <div className="surface-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Monitored Tenders</h3>
            <Radar className="w-4 h-4 text-brand-blue" />
          </div>
          <div className="grid grid-cols-3 gap-2 text-center mb-3">
            <div><div className="text-2xl font-extrabold">{monitored?.length ?? 0}</div><div className="text-[10px] text-muted-foreground">tracked</div></div>
            <div><div className="text-2xl font-extrabold text-orange-500">{closingSoon.length}</div><div className="text-[10px] text-muted-foreground">≤ 7 days</div></div>
            <div><div className="text-2xl font-extrabold text-destructive flex items-center justify-center gap-1">{closing48.length > 0 && <AlertTriangle className="w-4 h-4" />}{closing48.length}</div><div className="text-[10px] text-muted-foreground">≤ 48h</div></div>
          </div>
          <Link to="/monitoring" className="text-xs text-brand-blue hover:underline">Go to Monitoring →</Link>
        </div>

        {/* Company profile */}
        <div className="surface-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Company Profile</h3>
            <Building2 className="w-4 h-4 text-brand-teal" />
          </div>
          <div className="flex items-center gap-4 mb-3">
            <div className="relative w-16 h-16 shrink-0">
              <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                <circle cx="18" cy="18" r="16" fill="none" stroke="hsl(var(--surface-2))" strokeWidth="3" />
                <circle cx="18" cy="18" r="16" fill="none" stroke="hsl(var(--brand-teal))" strokeWidth="3" strokeDasharray={`${completeness.pct} 100`} pathLength="100" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-sm font-extrabold">{completeness.pct}%</div>
            </div>
            <div className="flex-1 min-w-0">
              {completeness.pct === 100 ? <span className="text-xs px-2 py-1 rounded bg-success/15 text-success font-bold">Complete</span> :
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  {completeness.missing.slice(0, 4).map((m) => <li key={m}>• {m}</li>)}
                </ul>}
            </div>
          </div>
          <Link to="/company-profile" className="text-xs text-brand-blue hover:underline">Complete Your Profile →</Link>
        </div>
      </div>

      <div className="surface-card p-6 mb-6 bg-gradient-to-br from-brand-blue/10 to-brand-teal/5 border-brand-blue/25">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-brand-teal text-xs uppercase tracking-widest mb-2">
              <Sparkles className="w-4 h-4" /> Quick start
            </div>
            <h2 className="text-2xl font-extrabold mb-1">Analyse your first tender</h2>
            <p className="text-muted-foreground text-sm max-w-md">Drop in a PDF — AI extracts everything in seconds.</p>
          </div>
          <Link to="/upload" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-display font-bold text-sm">
            <Upload className="w-4 h-4" /> Upload tender
          </Link>
        </div>
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-bold text-lg">Recent documents</h3>
          <Link to="/documents" className="text-xs text-brand-blue hover:underline inline-flex items-center gap-1">View all <ArrowRight className="w-3 h-3" /></Link>
        </div>
        {!list.length ? (
          <div className="surface-card p-10 text-center">
            <FileText className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No documents yet.</p>
          </div>
        ) : (
          <div className="surface-card divide-y divide-border">
            {list.slice(0, 5).map((d: any) => (
              <Link key={d.id} to="/documents/$id" params={{ id: d.id }} className="flex items-center justify-between p-4 hover:bg-surface-2/50 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="w-5 h-5 text-brand-blue shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{d.file_name}</div>
                    <div className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full ${
                  d.status === "completed" ? "bg-success/15 text-success" :
                  d.status === "processing" ? "bg-brand-blue/15 text-brand-blue" :
                  d.status === "failed" ? "bg-destructive/15 text-destructive" :
                  "bg-muted text-muted-foreground"
                }`}>{d.status}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
