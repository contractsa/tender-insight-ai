import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { analyzeDocument } from "@/lib/analyze.functions";
import { ArrowLeft, FileText, AlertTriangle, Calendar, User, CheckCircle2, Loader2, RefreshCw, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/documents/$id")({
  component: DocumentDetail,
});

function DocumentDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const analyzeFn = useServerFn(analyzeDocument);
  const [running, setRunning] = useState(false);
  const autoTriggered = useRef(false);

  const { data, isLoading } = useQuery({
    queryKey: ["document", id],
    queryFn: async () => {
      const { data: doc } = await supabase.from("documents").select("*").eq("id", id).single();
      const { data: analysis } = await supabase.from("tender_analyses").select("*").eq("document_id", id).maybeSingle();
      return { doc, analysis };
    },
    refetchInterval: (q) => (q.state.data?.doc?.status === "processing" ? 3000 : false),
  });

  async function runAnalysis() {
    if (running) return;
    setRunning(true);
    try {
      await analyzeFn({ data: { documentId: id } });
      toast.success("Analysis complete");
      qc.invalidateQueries({ queryKey: ["document", id] });
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Analysis failed";
      toast.error(msg);
      qc.invalidateQueries({ queryKey: ["document", id] });
    } finally {
      setRunning(false);
    }
  }

  // Auto-trigger once if doc is freshly uploaded
  useEffect(() => {
    if (autoTriggered.current) return;
    if (!data?.doc) return;
    if (data.doc.status === "uploaded" && !data.analysis) {
      autoTriggered.current = true;
      runAnalysis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.doc?.status]);

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!data?.doc) return <div className="p-8">Not found</div>;

  const { doc, analysis } = data;
  const isProcessing = doc.status === "processing" || running;

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      <Link to="/documents" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-5">
        <ArrowLeft className="w-4 h-4" /> Back to documents
      </Link>

      <header className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          <FileText className="w-8 h-8 text-brand-blue shrink-0 mt-1" />
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-extrabold break-words">{doc.file_name}</h1>
            <p className="text-sm text-muted-foreground mt-1">{new Date(doc.created_at).toLocaleString()} · {(doc.file_size / 1024 / 1024).toFixed(2)} MB</p>
          </div>
        </div>
        <span className={`text-xs px-3 py-1.5 rounded-full ${
          doc.status === "completed" ? "bg-success/15 text-success" :
          doc.status === "processing" ? "bg-brand-blue/15 text-brand-blue" :
          doc.status === "failed" ? "bg-destructive/15 text-destructive" :
          "bg-muted text-muted-foreground"
        }`}>{isProcessing ? "processing" : doc.status}</span>
      </header>

      {isProcessing && !analysis && (
        <div className="surface-card p-8 mb-6 text-center">
          <Loader2 className="w-10 h-10 text-brand-blue mx-auto mb-3 animate-spin" />
          <div className="font-semibold mb-1">AI is analysing your tender…</div>
          <p className="text-sm text-muted-foreground">This usually takes 20–60 seconds. You can stay on this page or come back later — we'll save the results.</p>
        </div>
      )}

      {doc.status === "uploaded" && !analysis && !running && (
        <div className="surface-card p-6 mb-6 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="font-semibold mb-1">Ready to analyse</div>
            <p className="text-sm text-muted-foreground">Uses 3 credits per document.</p>
          </div>
          <button onClick={runAnalysis} className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold inline-flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> Start analysis
          </button>
        </div>
      )}

      {doc.status === "failed" && (
        <div className="surface-card p-5 border-destructive/30 bg-destructive/5 mb-6">
          <div className="flex items-center gap-2 text-destructive font-semibold text-sm mb-1">
            <AlertTriangle className="w-4 h-4" /> Analysis failed
          </div>
          <p className="text-sm text-muted-foreground mb-3">{doc.error_message || "An unknown error occurred."}</p>
          <button onClick={runAnalysis} disabled={running} className="px-4 py-2 rounded-lg border border-border text-sm inline-flex items-center gap-2 hover:border-brand-blue hover:text-brand-blue disabled:opacity-60">
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Retry analysis
          </button>
        </div>
      )}

      {analysis && (
        <div className="space-y-6">
          <div className="surface-card p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-bold text-lg">Executive Summary</h2>
              {analysis.confidence_score && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-brand-blue/15 text-brand-blue">
                  {Math.round(analysis.confidence_score)}% confidence
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{analysis.summary}</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              ["Reference", analysis.reference_number],
              ["Issuer", analysis.issuing_entity],
              ["Closing Date", analysis.closing_date],
              ["Estimated Value", analysis.estimated_value],
              ["CIDB Grade", analysis.cidb_grade],
              ["B-BBEE Level", analysis.bbbee_level],
            ].map(([label, value]) => (
              <div key={label} className="surface-card p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
                <div className="text-sm font-medium">{value || <span className="text-muted-foreground/50">—</span>}</div>
              </div>
            ))}
          </div>

          {analysis.scope_of_work && (
            <div className="surface-card p-6">
              <h3 className="font-display font-bold mb-3">Scope of Work</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{analysis.scope_of_work}</p>
            </div>
          )}

          {(() => {
            const compliance = (analysis.compliance_requirements ?? []) as string[];
            return compliance.length > 0 && (
              <div className="surface-card p-6">
                <h3 className="font-display font-bold mb-3 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-success" /> Compliance Requirements</h3>
                <ul className="space-y-2">
                  {compliance.map((c, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex gap-2"><span className="text-success">✓</span> {c}</li>
                  ))}
                </ul>
              </div>
            );
          })()}

          {(() => {
            const clauses = (analysis.key_clauses ?? []) as Array<{ title: string; detail: string }>;
            return clauses.length > 0 && (
              <div className="surface-card p-6">
                <h3 className="font-display font-bold mb-3">Key Clauses</h3>
                <div className="space-y-3">
                  {clauses.map((c, i) => (
                    <div key={i} className="pb-3 border-b border-border last:border-b-0 last:pb-0">
                      <div className="font-semibold text-sm mb-1">{c.title}</div>
                      <div className="text-sm text-muted-foreground">{c.detail}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {(() => {
            const risks = (analysis.risks ?? []) as Array<{ severity: string; description: string }>;
            return risks.length > 0 && (
              <div className="surface-card p-6">
                <h3 className="font-display font-bold mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-warning" /> Risks</h3>
                <div className="space-y-2">
                  {risks.map((r, i) => (
                    <div key={i} className="flex gap-3 items-start">
                      <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${
                        r.severity === "high" ? "bg-destructive/15 text-destructive" :
                        r.severity === "medium" ? "bg-warning/15 text-warning" :
                        "bg-muted text-muted-foreground"
                      }`}>{r.severity}</span>
                      <p className="text-sm text-muted-foreground">{r.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {(() => {
            const dates = (analysis.important_dates ?? []) as Array<{ event: string; date: string }>;
            return dates.length > 0 && (
              <div className="surface-card p-6">
                <h3 className="font-display font-bold mb-3 flex items-center gap-2"><Calendar className="w-4 h-4 text-brand-blue" /> Important Dates</h3>
                <div className="space-y-2">
                  {dates.map((d, i) => (
                    <div key={i} className="flex justify-between text-sm gap-3">
                      <span className="text-muted-foreground">{d.event}</span>
                      <span className="font-medium text-brand-blue">{d.date}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {analysis.contact_info && (analysis.contact_info as any).name && (
            <div className="surface-card p-6">
              <h3 className="font-display font-bold mb-3 flex items-center gap-2"><User className="w-4 h-4" /> Contact</h3>
              <div className="text-sm space-y-1">
                <div>{(analysis.contact_info as any).name}</div>
                {(analysis.contact_info as any).email && <div className="text-brand-blue">{(analysis.contact_info as any).email}</div>}
                {(analysis.contact_info as any).phone && <div className="text-muted-foreground">{(analysis.contact_info as any).phone}</div>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
