import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { analyzeDocument } from "@/lib/analyze.functions";
import { FileText, RefreshCw, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/documents/")({
  component: DocumentsList,
});

function formatBytes(bytes: any): string {
  const n = typeof bytes === "number" ? bytes : Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

const STALE_MS = 5 * 60 * 1000;

function effectiveStatus(d: any): { status: string; needsRecover: boolean } {
  const updatedAt = d?.updated_at ? new Date(d.updated_at).getTime() : 0;
  if (d?.status === "processing" && Date.now() - updatedAt > STALE_MS) {
    return { status: "failed", needsRecover: true };
  }
  // Completed but no usable result of any kind -> needs re-process
  const hasResult =
    d?.master_result || d?.analysis_result || d?.result || d?.extraction_result || d?.ai_result;
  if (d?.status === "completed" && !hasResult) {
    return { status: "failed", needsRecover: true };
  }
  if (d?.status === "failed") return { status: "failed", needsRecover: true };
  return { status: d?.status ?? "uploaded", needsRecover: false };
}

function DocumentsList() {
  const qc = useQueryClient();
  const analyzeFn = useServerFn(analyzeDocument);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: docs, isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      // Auto-reset stuck "processing" jobs older than 5 minutes
      const cutoff = new Date(Date.now() - STALE_MS).toISOString();
      await supabase
        .from("documents")
        .update({ status: "failed", error_message: "Processing timed out — please retry" })
        .eq("status", "processing")
        .lt("updated_at", cutoff);

      const { data } = await supabase
        .from("documents")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    refetchInterval: 10_000,
  });

  async function reprocess(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    if (busyId) return;
    setBusyId(id);
    try {
      await analyzeFn({ data: { documentId: id } });
      toast.success("Re-processing started");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start re-processing");
    } finally {
      setBusyId(null);
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["document", id] });
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-extrabold mb-1">Documents</h1>
      <p className="text-muted-foreground text-sm mb-8">All your analysed tenders and contracts.</p>

      {isLoading ? (
        <div className="text-muted-foreground text-sm">Loading…</div>
      ) : !docs || docs.length === 0 ? (
        <div className="surface-card p-10 text-center">
          <FileText className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-4">No documents yet.</p>
          <Link to="/upload" className="inline-block px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">Upload your first</Link>
        </div>
      ) : (
        <div className="surface-card divide-y divide-border">
          {docs.map((d: any) => {
            const eff = effectiveStatus(d);
            const busy = busyId === d.id;
            return (
              <Link key={d.id} to="/documents/$id" params={{ id: d.id }}
                className="flex items-center justify-between p-4 hover:bg-surface-2/50 transition-colors gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <FileText className="w-5 h-5 text-brand-blue shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{d.file_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(d.created_at).toLocaleString()} · {formatBytes(d.file_size)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {eff.needsRecover && (
                    <button
                      onClick={(e) => reprocess(e, d.id)}
                      disabled={busy}
                      className="text-xs px-2.5 py-1 rounded-lg border border-border hover:border-brand-blue hover:text-brand-blue inline-flex items-center gap-1.5 disabled:opacity-60"
                    >
                      {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      Re-Process
                    </button>
                  )}
                  <span className={`text-xs px-2.5 py-1 rounded-full ${
                    eff.status === "completed" ? "bg-success/15 text-success" :
                    eff.status === "processing" ? "bg-brand-blue/15 text-brand-blue" :
                    eff.status === "failed" ? "bg-destructive/15 text-destructive" :
                    "bg-muted text-muted-foreground"
                  }`}>{eff.status}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
