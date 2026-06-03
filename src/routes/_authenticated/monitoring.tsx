import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Radar, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/monitoring")({
  component: MonitoringPage,
});

function countdown(date?: string | null) {
  if (!date) return { label: "—", tone: "muted" as const };
  const ms = new Date(date).getTime() - Date.now();
  if (ms <= 0) return { label: "Closed", tone: "destructive" as const };
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (ms < 2 * 86_400_000) return { label: `${days}d ${hours}h`, tone: "destructive" as const };
  if (ms < 7 * 86_400_000) return { label: `${days}d ${hours}h`, tone: "amber" as const };
  return { label: `${days}d ${hours}h`, tone: "teal" as const };
}

function MonitoringPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["monitored_tenders"],
    queryFn: async () => {
      const { data } = await supabase.from("monitored_tenders").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function remove(id: string) {
    const { error } = await supabase.from("monitored_tenders").delete().eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["monitored_tenders"] });
  }

  async function refresh(id: string) {
    const { error } = await supabase.from("monitored_tenders").update({ last_checked: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Refreshed"); qc.invalidateQueries({ queryKey: ["monitored_tenders"] }); }
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Radar className="w-5 h-5 text-brand-teal" />
        <h1 className="text-3xl font-extrabold">Monitored Tenders</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">Tenders you're watching for closing date changes and addenda.</p>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : !data || data.length === 0 ? (
        <div className="surface-card p-10 text-center">
          <Radar className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-4">You're not monitoring any tenders yet.</p>
          <Link to="/documents" className="inline-block px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">
            Browse Documents
          </Link>
        </div>
      ) : (
        <div className="surface-card divide-y divide-border">
          {data.map((t: any) => {
            const c = countdown(t.closing_date);
            const tone = c.tone === "destructive" ? "bg-destructive/15 text-destructive" : c.tone === "amber" ? "bg-amber-500/15 text-amber-400" : "bg-brand-teal/15 text-brand-teal";
            return (
              <div key={t.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{t.tender_title ?? t.tender_reference ?? "Untitled tender"}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.tender_reference ?? "—"} · last checked {t.last_checked ? new Date(t.last_checked).toLocaleString() : "never"}
                  </div>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full ${tone}`}>{c.label}</span>
                <button onClick={() => refresh(t.id)} className="p-2 rounded-lg hover:bg-surface-2 text-muted-foreground hover:text-brand-blue" aria-label="Refresh">
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button onClick={() => remove(t.id)} className="p-2 rounded-lg hover:bg-surface-2 text-muted-foreground hover:text-destructive" aria-label="Remove">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
