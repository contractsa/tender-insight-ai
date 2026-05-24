import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Upload, FileText, Sparkles, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("user_id", user!.id).single();
      return data;
    },
  });

  const { data: docs } = useQuery({
    queryKey: ["recent-docs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("documents").select("*").order("created_at", { ascending: false }).limit(5);
      return data ?? [];
    },
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold">Welcome back{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}</h1>
        <p className="text-muted-foreground mt-1">Upload a tender to extract structured insights in seconds.</p>
      </header>

      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <div className="surface-card p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Credits remaining</div>
          <div className="font-display font-extrabold text-3xl text-brand-blue">{profile?.credits_remaining ?? "—"}</div>
          <div className="text-xs text-muted-foreground mt-1">of {profile?.credits_total ?? 0} this period</div>
        </div>
        <div className="surface-card p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Plan</div>
          <div className="font-display font-extrabold text-3xl text-brand-teal capitalize">{profile?.plan ?? "Trial"}</div>
          <Link to="/pricing" className="text-xs text-brand-blue hover:underline mt-1 inline-block">Upgrade →</Link>
        </div>
        <div className="surface-card p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Documents analysed</div>
          <div className="font-display font-extrabold text-3xl text-brand-gold">{docs?.length ?? 0}</div>
        </div>
      </div>

      <div className="surface-card p-8 mb-8 bg-gradient-to-br from-brand-blue/10 to-brand-teal/5 border-brand-blue/25">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-brand-teal text-xs uppercase tracking-widest mb-3">
              <Sparkles className="w-4 h-4" /> Quick start
            </div>
            <h2 className="text-2xl font-extrabold mb-2">Analyse your first tender</h2>
            <p className="text-muted-foreground text-sm max-w-md">Drop in a PDF — government tender, NEC contract, municipal RFQ. AI extracts everything in seconds.</p>
          </div>
          <Link to="/upload" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-display font-bold text-sm glow-blue hover:scale-[1.02] transition-transform">
            <Upload className="w-4 h-4" /> Upload tender
          </Link>
        </div>
      </div>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-lg">Recent documents</h3>
          <Link to="/documents" className="text-xs text-brand-blue hover:underline inline-flex items-center gap-1">View all <ArrowRight className="w-3 h-3" /></Link>
        </div>
        {!docs || docs.length === 0 ? (
          <div className="surface-card p-10 text-center">
            <FileText className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No documents yet. Upload your first tender to get started.</p>
          </div>
        ) : (
          <div className="surface-card divide-y divide-border">
            {docs.map((d) => (
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
