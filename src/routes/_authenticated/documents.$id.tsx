import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { analyzeDocument, retryExtractionPass } from "@/lib/analyze.functions";
import {
  ArrowLeft, AlertTriangle, Loader2, RefreshCw, Sparkles, Download,
  FileJson, FileSpreadsheet, FileText as FileTextIcon, X, ListChecks, Clock,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/documents/$id")({
  component: DocumentDetail,
});

// ============================================================
// Helpers
// ============================================================
function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
function csvEscape(v: any): string {
  if (v == null) return "";
  const s = String(v).replace(/"/g, '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
}
function buildCsv(master: any, docName: string): string {
  const out: string[] = [];
  const sheet = (title: string, headers: string[], rows: any[][]) => {
    out.push(`### ${title} ###`);
    out.push(headers.map(csvEscape).join(","));
    for (const r of rows) out.push(r.map(csvEscape).join(","));
    out.push("");
  };
  const tri = master.triage ?? {};
  const sub = master.submission?.submission ?? {};
  sheet("Summary", ["Field", "Value"], [
    ["Document", docName], ["Type", tri.document_type], ["Issuer", tri.issuing_entity],
    ["Industry", tri.industry_domain], ["Total pages", tri.total_pages], ["Complexity", tri.estimated_complexity],
    ["Closing date", sub.closing_date], ["Closing time", sub.closing_time], ["Submission method", sub.submission_method],
    ["Overall confidence", master.meta?.overall_confidence],
  ]);
  sheet("Returnables", ["Name", "Page", "Form Type", "Mandatory", "Disqualifies", "Signature", "Witness", "Commissioner", "Purpose"],
    (master.returnables?.returnables ?? []).map((r: any) => [r.name, r.page_number, r.form_type, r.mandatory, r.disqualifies_if_missing, r.requires_signature, r.requires_witness, r.requires_commissioner_of_oaths, r.purpose]));
  sheet("Compliance", ["Document", "Mandatory", "Disqualifies", "Page", "Notes"],
    (master.submission?.mandatory_compliance_documents ?? []).map((d: any) => [d.document_name, d.mandatory, d.disqualifies_if_missing, d.page_reference, d.notes]));
  const ev = master.evaluation?.evaluation_methodology ?? {};
  const evalRows: any[][] = [];
  for (const c of ev.stage_1_administrative?.criteria ?? []) evalRows.push(["Stage 1 Admin", c.criterion, "", c.mandatory, "", c.page_reference]);
  for (const c of ev.stage_2_functionality?.criteria ?? []) evalRows.push(["Stage 2 Functionality", c.criterion, c.weight, c.maximum_points, c.scoring_guide, c.page_reference]);
  for (const t of ev.stage_3_price_and_preference?.bbbee_points_table ?? []) evalRows.push(["Stage 3 B-BBEE", t.bbbee_level, "", t.points_awarded, "", ev.stage_3_price_and_preference?.page_reference]);
  sheet("Evaluation", ["Stage", "Criterion/Level", "Weight", "Max/Points", "Scoring Guide", "Page"], evalRows);
  const priceRows: any[][] = [];
  for (const sch of master.pricing?.pricing_schedules ?? []) {
    for (const r of sch.rows ?? []) priceRows.push([sch.schedule_name, sch.page_number, r.item_no, r.description, r.unit, r.quantity, r.rate_column, r.amount_column]);
  }
  sheet("Pricing", ["Schedule", "Page", "Item", "Description", "Unit", "Qty", "Rate", "Amount"], priceRows);
  sheet("Risk Flags", ["Severity", "Category", "Flag", "Page", "Action Required"],
    (master.risk_flags ?? []).map((f: any) => [f.severity, f.category, f.flag, f.page_reference, f.action_required]));
  sheet("Page Intelligence", ["Page", "Section", "Action Required", "Action", "Mandatory", "Has Table", "Has Graph", "Confidence", "Review Flag"],
    (master.page_level_intelligence ?? []).map((p: any) => [p.page, p.section_type, p.action_required, p.action, p.mandatory, p.contains_table, p.contains_graph, p.confidence, p.review_flag]));
  return out.join("\n");
}
function buildHtmlChecklist(master: any, docName: string): string {
  const returnables = master.returnables?.returnables ?? [];
  const rows = returnables.map((r: any) => `
    <tr>
      <td style="border:1px solid #ccc;padding:6px;text-align:center;width:30px;">☐</td>
      <td style="border:1px solid #ccc;padding:6px;">${r.name ?? ""}</td>
      <td style="border:1px solid #ccc;padding:6px;text-align:center;">${r.page_number ?? ""}</td>
      <td style="border:1px solid #ccc;padding:6px;text-align:center;">${r.mandatory ? "Yes" : "No"}</td>
      <td style="border:1px solid #ccc;padding:6px;font-size:11px;">
        ${r.requires_signature ? "Signature " : ""}${r.requires_witness ? "Witness " : ""}${r.requires_commissioner_of_oaths ? "Commissioner" : ""}
      </td>
    </tr>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Submission Checklist — ${docName}</title>
<style>body{font-family:Arial,sans-serif;padding:24px;color:#111}h1{font-size:18px;margin:0 0 4px}h2{font-size:13px;color:#666;margin:0 0 18px;font-weight:normal}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#f4f4f4;border:1px solid #ccc;padding:6px;text-align:left}@media print{body{padding:12px}}</style>
</head><body><h1>Submission Checklist</h1><h2>${docName} — generated ${new Date().toLocaleString()}</h2>
<table><thead><tr><th style="width:30px;">✓</th><th>Returnable</th><th style="width:60px;">Page</th><th style="width:80px;">Mandatory</th><th>Requirements</th></tr></thead><tbody>${rows || '<tr><td colspan="5" style="border:1px solid #ccc;padding:12px;text-align:center;color:#999;">No returnables extracted</td></tr>'}</tbody></table>
<p style="margin-top:24px;font-size:11px;color:#666;">Generated by ContractIQ SA. Verify all items against the original document before submission.</p>
</body></html>`;
}
function daysUntil(s?: string | null): number | null {
  if (!s) return null;
  const d = new Date(s); if (isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

// ============================================================
// MAIN COMPONENT
// ============================================================
function DocumentDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const analyzeFn = useServerFn(analyzeDocument);
  const retryFn = useServerFn(retryExtractionPass);
  const [running, setRunning] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tab, setTab] = useState<TabKey>("summary");
  const autoTriggered = useRef(false);

  const { data, isLoading } = useQuery({
    queryKey: ["document", id],
    queryFn: async () => {
      const { data: doc } = await supabase.from("documents").select("*").eq("id", id).single();
      return { doc };
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
      toast.error(err instanceof Error ? err.message : "Analysis failed");
      qc.invalidateQueries({ queryKey: ["document", id] });
    } finally { setRunning(false); }
  }

  async function retryPass(pass: string) {
    setRetrying(pass);
    try {
      await retryFn({ data: { documentId: id, pass: pass as any } });
      toast.success(`Re-ran ${pass}`);
      qc.invalidateQueries({ queryKey: ["document", id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Retry failed`);
    } finally { setRetrying(null); }
  }

  useEffect(() => {
    if (autoTriggered.current) return;
    if (!data?.doc) return;
    if (data.doc.status === "uploaded" && !(data.doc as any).master_result) {
      autoTriggered.current = true;
      runAnalysis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.doc?.status]);

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!data?.doc) return <div className="p-8">Not found</div>;

  const doc = data.doc as any;
  const isProcessing = doc.status === "processing" || running;
  const master = doc.master_result;

  // Pre-analysis states
  if (!master) {
    return (
      <div className="p-4 sm:p-8 max-w-3xl mx-auto">
        <Link to="/documents" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-5">
          <ArrowLeft className="w-4 h-4" /> Back to documents
        </Link>
        <h1 className="text-xl font-extrabold break-words mb-1">{doc.file_name}</h1>
        <p className="text-sm text-muted-foreground mb-6">{new Date(doc.created_at).toLocaleString()} · {(doc.file_size / 1024 / 1024).toFixed(2)} MB</p>

        {isProcessing && (
          <div className="surface-card p-8 text-center">
            <Loader2 className="w-10 h-10 text-brand-blue mx-auto mb-3 animate-spin" />
            <div className="font-semibold mb-1">Running 5-pass procurement extraction…</div>
            <p className="text-sm text-muted-foreground">Triage · Submission · Returnables · Evaluation · Pricing · Contract running in parallel. 30–60 seconds for most documents.</p>
          </div>
        )}
        {doc.status === "uploaded" && !running && (
          <div className="surface-card p-6 flex items-center justify-between gap-4 flex-wrap">
            <div><div className="font-semibold mb-1">Ready to analyse</div><p className="text-sm text-muted-foreground">Uses 3 credits per document.</p></div>
            <button onClick={runAnalysis} className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold inline-flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Start analysis
            </button>
          </div>
        )}
        {doc.status === "failed" && (
          <div className="surface-card p-5 border-destructive/30 bg-destructive/5">
            <div className="flex items-center gap-2 text-destructive font-semibold text-sm mb-1">
              <AlertTriangle className="w-4 h-4" /> Analysis failed
            </div>
            <p className="text-sm text-muted-foreground mb-3">{doc.error_message || "Unknown error"}</p>
            <button onClick={runAnalysis} disabled={running} className="px-4 py-2 rounded-lg border border-border text-sm inline-flex items-center gap-2 hover:border-brand-blue hover:text-brand-blue disabled:opacity-60">
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Retry analysis
            </button>
          </div>
        )}
      </div>
    );
  }

  // ===== Split panel layout =====
  return (
    <div className="flex flex-col md:flex-row h-screen md:overflow-hidden">
      {/* Mobile floating button */}
      <button
        onClick={() => setDrawerOpen(true)}
        className="md:hidden fixed bottom-4 right-4 z-30 px-4 py-3 rounded-full bg-primary text-primary-foreground text-sm font-bold shadow-lg inline-flex items-center gap-2"
      >
        <ListChecks className="w-4 h-4" /> Compliance Panel
      </button>

      {/* Mobile drawer backdrop */}
      {drawerOpen && (
        <div onClick={() => setDrawerOpen(false)} className="md:hidden fixed inset-0 z-40 bg-background/80 backdrop-blur-sm" />
      )}

      {/* LEFT PANEL */}
      <aside className={`
        ${drawerOpen ? "translate-y-0" : "translate-y-full"} md:translate-y-0
        fixed md:static inset-x-0 bottom-0 top-14 md:top-0 z-50 md:z-auto
        md:w-[280px] md:shrink-0 md:h-screen md:overflow-y-auto
        bg-surface-1 md:border-r border-border
        rounded-t-2xl md:rounded-none
        flex flex-col
        transition-transform duration-200
      `}>
        <div className="md:hidden flex justify-end p-3 sticky top-0 bg-surface-1 z-10">
          <button onClick={() => setDrawerOpen(false)} className="p-2"><X className="w-5 h-5" /></button>
        </div>
        <SidePanel doc={doc} master={master} setTab={(t) => { setTab(t); setDrawerOpen(false); }} />
      </aside>

      {/* RIGHT PANEL */}
      <main className="flex-1 min-w-0 md:overflow-y-auto">
        <div className="px-4 sm:px-6 lg:px-8 py-4 border-b border-border sticky top-0 bg-background z-10">
          <Link to="/documents" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground mb-2">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to documents
          </Link>
          <TabBar tab={tab} setTab={setTab} />
        </div>

        <div className="p-4 sm:p-6 lg:p-8">
          {(doc.extraction_failed_passes?.length ?? 0) > 0 && (
            <div className="surface-card p-4 mb-4 border-warning/40 bg-warning/5">
              <div className="flex items-center gap-2 text-warning font-semibold text-sm mb-2">
                <AlertTriangle className="w-4 h-4" /> Some extraction passes failed
              </div>
              <div className="flex flex-wrap gap-2">
                {doc.extraction_failed_passes.map((p: string) => (
                  <button key={p} onClick={() => retryPass(p)} disabled={retrying === p}
                    className="px-3 py-1.5 rounded-lg border border-warning/40 text-xs inline-flex items-center gap-2 hover:bg-warning/10 disabled:opacity-60">
                    {retrying === p ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Retry {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          <TabPanel tab={tab} master={master} />
        </div>
      </main>
    </div>
  );
}

// ============================================================
// SIDE PANEL
// ============================================================
function SidePanel({ doc, master, setTab }: { doc: any; master: any; setTab: (t: TabKey) => void }) {
  const triage = master.triage ?? {};
  const sub = master.submission?.submission ?? {};
  const flags: any[] = master.risk_flags ?? [];
  const compliance: any[] = master.compliance_checklist ?? [];
  const returnables: any[] = master.returnables?.returnables ?? [];
  const pageIntel: any[] = master.page_level_intelligence ?? [];
  const dqCount = returnables.filter((r) => r.disqualifies_if_missing).length;

  const sevColor: Record<string, string> = {
    critical: "bg-destructive text-destructive-foreground",
    high: "bg-orange-500 text-white",
    medium: "bg-yellow-400 text-black",
    low: "bg-muted text-muted-foreground",
  };
  const complexBadge: Record<string, string> = {
    low: "bg-success/15 text-success",
    medium: "bg-brand-blue/15 text-brand-blue",
    high: "bg-orange-500/15 text-orange-600",
    very_high: "bg-destructive/15 text-destructive",
  };

  function download(type: "json" | "csv" | "html") {
    const safe = (doc.file_name || "document").replace(/\.[^.]+$/, "").replace(/[^a-z0-9-]+/gi, "-");
    const date = new Date().toISOString().slice(0, 10);
    if (type === "json") downloadBlob(`contractiq-${safe}-${date}.json`, JSON.stringify(master, null, 2), "application/json");
    if (type === "csv") downloadBlob(`contractiq-${safe}-${date}.csv`, buildCsv(master, doc.file_name), "text/csv");
    if (type === "html") downloadBlob(`contractiq-checklist-${safe}-${date}.html`, buildHtmlChecklist(master, doc.file_name), "text/html");
  }

  return (
    <div className="p-4 space-y-4 pb-8">
      {/* Header */}
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Document</div>
        <h2 className="font-bold text-sm break-words">{triage.issuing_entity || doc.file_name}</h2>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{master.procurement_summary?.one_line}</p>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {triage.document_type && <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted">{triage.document_type}</span>}
          {triage.estimated_complexity && <span className={`text-[10px] px-2 py-0.5 rounded-full ${complexBadge[triage.estimated_complexity] ?? "bg-muted"}`}>{triage.estimated_complexity}</span>}
        </div>
      </div>

      {/* Risk Flags */}
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Risk Flags <span className="ml-1 text-foreground">({flags.length})</span></div>
        <div className="space-y-1">
          {flags.length === 0 && <p className="text-xs text-muted-foreground">No risks flagged.</p>}
          {flags.slice(0, 12).map((f, i) => (
            <button key={i} onClick={() => setTab("summary")}
              className="w-full flex items-center gap-2 text-xs text-left p-2 rounded-lg hover:bg-surface-2 transition-colors">
              <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded shrink-0 ${sevColor[f.severity] ?? "bg-muted"}`}>{f.severity}</span>
              <span className="truncate">{f.flag}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Compliance Checklist */}
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Compliance ({compliance.length})</div>
        <ul className="space-y-1">
          {compliance.slice(0, 15).map((c, i) => (
            <li key={i} className="flex items-start gap-2 text-xs p-1.5">
              <span className="w-3 h-3 border border-border rounded-sm mt-0.5 shrink-0"></span>
              <span className="flex-1 min-w-0 truncate">{c.name}</span>
              {c.disqualifies_if_missing && <span className="text-[9px] px-1.5 py-0.5 rounded bg-destructive/15 text-destructive font-bold shrink-0">DISQUALIFIES</span>}
            </li>
          ))}
        </ul>
      </div>

      {/* Returnables Counter */}
      <div className="p-3 rounded-lg bg-surface-2">
        <div className="text-xs text-muted-foreground mb-1">Returnables</div>
        <div className="flex items-baseline gap-3">
          <div><span className="text-2xl font-bold">{returnables.length}</span><span className="text-xs text-muted-foreground ml-1">total</span></div>
          <div><span className="text-lg font-bold text-destructive">{dqCount}</span><span className="text-xs text-muted-foreground ml-1">disqualifying</span></div>
        </div>
      </div>

      {/* Page Navigator */}
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Pages of Interest ({pageIntel.length})</div>
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {pageIntel.slice(0, 60).map((p, i) => (
            <button key={i} onClick={() => setTab("pages")}
              className="w-full flex items-center gap-2 text-xs p-1.5 rounded hover:bg-surface-2 text-left">
              <span className="font-mono font-bold shrink-0 w-6">{p.page}</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted shrink-0">{(p.section_type ?? "").slice(0, 10)}</span>
              {p.action_required && <span className="text-[9px] px-1.5 py-0.5 rounded bg-brand-blue/15 text-brand-blue font-bold shrink-0">ACTION</span>}
              {p.review_flag && <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-400/20 text-yellow-700 font-bold shrink-0">REVIEW</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Downloads */}
      <div className="space-y-2 pt-2 border-t border-border">
        <button onClick={() => download("json")} className="w-full px-3 py-2 rounded-lg border border-border text-xs font-medium inline-flex items-center justify-center gap-2 hover:border-brand-blue hover:text-brand-blue">
          <FileJson className="w-3.5 h-3.5" /> Download Full JSON
        </button>
        <button onClick={() => download("csv")} className="w-full px-3 py-2 rounded-lg border border-border text-xs font-medium inline-flex items-center justify-center gap-2 hover:border-brand-blue hover:text-brand-blue">
          <FileSpreadsheet className="w-3.5 h-3.5" /> Download Excel Report
        </button>
        <button onClick={() => download("html")} className="w-full px-3 py-2 rounded-lg border border-border text-xs font-medium inline-flex items-center justify-center gap-2 hover:border-brand-blue hover:text-brand-blue">
          <FileTextIcon className="w-3.5 h-3.5" /> Download Submission Checklist
        </button>
      </div>
    </div>
  );
}

// ============================================================
// TAB BAR + PANEL
// ============================================================
type TabKey = "summary" | "submission" | "returnables" | "evaluation" | "pricing" | "contract" | "pages" | "missing";

const TABS: { key: TabKey; label: string }[] = [
  { key: "summary", label: "Summary" }, { key: "submission", label: "Submission" },
  { key: "returnables", label: "Returnables" }, { key: "evaluation", label: "Evaluation" },
  { key: "pricing", label: "Pricing" }, { key: "contract", label: "Contract" },
  { key: "pages", label: "Pages" }, { key: "missing", label: "Missing Data" },
];

function TabBar({ tab, setTab }: { tab: TabKey; setTab: (t: TabKey) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto -mx-1 px-1 scrollbar-hide">
      {TABS.map((t) => (
        <button key={t.key} onClick={() => setTab(t.key)}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
            tab === t.key ? "bg-brand-blue text-white" : "text-muted-foreground hover:bg-surface-2"
          }`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

function TabPanel({ tab, master }: { tab: TabKey; master: any }) {
  switch (tab) {
    case "summary": return <SummaryTab master={master} />;
    case "submission": return <SubmissionTab master={master} />;
    case "returnables": return <ReturnablesTab master={master} />;
    case "evaluation": return <EvaluationTab master={master} />;
    case "pricing": return <PricingTab master={master} />;
    case "contract": return <ContractTab master={master} />;
    case "pages": return <PagesTab master={master} />;
    case "missing": return <MissingTab master={master} />;
  }
}

// ============================================================
// TAB COMPONENTS
// ============================================================
function SummaryTab({ master }: { master: any }) {
  const tri = master.triage ?? {};
  return (
    <div className="space-y-6 max-w-4xl">
      <p className="text-xl font-bold leading-relaxed">{master.procurement_summary?.one_line ?? "Procurement document"}</p>

      <div>
        <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">Bid Viability Factors</h3>
        <ul className="space-y-1.5">
          {(master.procurement_summary?.bid_viability_factors ?? []).map((f: string, i: number) => (
            <li key={i} className="flex items-start gap-2 text-sm"><span className="text-brand-blue mt-0.5">✓</span>{f}</li>
          ))}
        </ul>
      </div>

      <div className="surface-card p-5">
        <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">Document Metadata</h3>
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          {[
            ["Type", tri.document_type], ["Authority", tri.procurement_authority_type],
            ["Issuer", tri.issuing_entity], ["Industry", tri.industry_domain],
            ["Total pages", tri.total_pages], ["Complexity", tri.estimated_complexity],
            ["Extraction confidence", master.meta?.overall_confidence != null ? `${Math.round(master.meta.overall_confidence * 100)}%` : null],
            ["Extraction version", master.meta?.extraction_version],
          ].filter(([, v]) => v != null && v !== "").map(([k, v]) => (
            <div key={k as string} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className="font-medium">{String(v)}</dd></div>
          ))}
        </dl>
      </div>

      {(master.risk_flags ?? []).length > 0 && (
        <div className="surface-card p-5">
          <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">All Risk Flags</h3>
          <div className="space-y-2">
            {master.risk_flags.map((f: any, i: number) => (
              <div key={i} className="flex gap-3 items-start text-sm">
                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded shrink-0 ${
                  f.severity === "critical" ? "bg-destructive text-destructive-foreground" :
                  f.severity === "high" ? "bg-orange-500 text-white" :
                  f.severity === "medium" ? "bg-yellow-400 text-black" : "bg-muted text-muted-foreground"
                }`}>{f.severity}</span>
                <div><div className="font-medium">{f.flag}</div><div className="text-xs text-muted-foreground mt-0.5">{f.action_required}{f.page_reference ? ` · p.${f.page_reference}` : ""}</div></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SubmissionTab({ master }: { master: any }) {
  const s = master.submission?.submission ?? {};
  const b = s.briefing_session;
  const d = daysUntil(s.closing_date);
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="surface-card p-6 text-center">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center justify-center gap-2"><Clock className="w-4 h-4" />Closing Date</div>
        <div className="text-3xl sm:text-4xl font-extrabold mb-1">{s.closing_date ?? "—"}</div>
        {s.closing_time && <div className="text-lg text-muted-foreground mb-2">{s.closing_time}</div>}
        {d !== null && (
          <div className={`inline-block mt-2 px-4 py-1.5 rounded-full font-bold text-sm ${
            d < 0 ? "bg-muted text-muted-foreground" : d <= 3 ? "bg-destructive/15 text-destructive" : d <= 14 ? "bg-orange-500/15 text-orange-600" : "bg-success/15 text-success"
          }`}>{d < 0 ? "Closed" : d === 0 ? "Closes today" : `${d} days remaining`}</div>
        )}
      </div>

      {b?.mandatory && (
        <div className="surface-card p-5 border-destructive/40 bg-destructive/5">
          <div className="flex items-center gap-2 text-destructive font-bold text-sm mb-2"><AlertTriangle className="w-4 h-4" />MANDATORY BRIEFING SESSION</div>
          <dl className="text-sm space-y-1">
            <Row k="Date" v={b.date} /><Row k="Time" v={b.time} /><Row k="Venue" v={b.venue} />
            <Row k="Attendance register" v={b.attendance_register_required ? "Required" : "Optional"} />
            <Row k="Non-attendance" v={b.non_attendance_consequence} />
          </dl>
        </div>
      )}

      <div className="surface-card p-5">
        <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">Submission Details</h3>
        <dl className="text-sm space-y-1.5">
          <Row k="Method" v={s.submission_method} />
          <Row k="Physical address" v={s.physical_address} />
          <Row k="Portal URL" v={s.portal_url} />
          <Row k="Copies required" v={s.number_of_copies} />
          <Row k="Packaging" v={s.packaging_instructions} />
          <Row k="Labelling" v={s.labelling_instructions} />
        </dl>
      </div>
    </div>
  );
}

function ReturnablesTab({ master }: { master: any }) {
  const list: any[] = master.returnables?.returnables ?? [];
  if (list.length === 0) return <p className="text-sm text-muted-foreground">No returnables extracted.</p>;
  return (
    <div className="space-y-3 max-w-4xl">
      <p className="text-sm text-muted-foreground mb-2">
        {list.length} returnables · {list.filter((r) => r.disqualifies_if_missing).length} disqualifying
      </p>
      {list.map((r, i) => (
        <div key={i} className={`surface-card p-4 ${r.disqualifies_if_missing ? "border-l-4 border-l-destructive" : ""}`}>
          <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold text-sm">{r.name}</h4>
              {r.requires_commissioner_of_oaths && <AlertTriangle className="w-4 h-4 text-yellow-500" />}
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {r.page_number != null && <button className="text-[10px] px-2 py-0.5 rounded bg-brand-blue/15 text-brand-blue font-bold">p.{r.page_number}</button>}
              {r.form_type && <span className="text-[10px] px-2 py-0.5 rounded bg-muted uppercase">{r.form_type}</span>}
              {r.mandatory && <span className="text-[10px] px-2 py-0.5 rounded bg-orange-500/15 text-orange-600 font-bold">MANDATORY</span>}
              {r.disqualifies_if_missing && <span className="text-[10px] px-2 py-0.5 rounded bg-destructive text-destructive-foreground font-bold">DISQUALIFIES</span>}
            </div>
          </div>
          {r.purpose && <p className="text-xs text-muted-foreground mb-2">{r.purpose}</p>}
          {Array.isArray(r.fields_to_complete) && r.fields_to_complete.length > 0 && (
            <div className="text-xs mb-2">
              <span className="text-muted-foreground">Fields: </span>{r.fields_to_complete.join(" · ")}
            </div>
          )}
          <div className="flex gap-1.5 flex-wrap text-[10px]">
            {r.requires_signature && <span className="px-1.5 py-0.5 rounded bg-muted">Signature</span>}
            {r.requires_witness && <span className="px-1.5 py-0.5 rounded bg-muted">Witness</span>}
            {r.requires_commissioner_of_oaths && <span className="px-1.5 py-0.5 rounded bg-yellow-400/20 text-yellow-700 font-bold">Commissioner of Oaths</span>}
            {r.requires_company_stamp && <span className="px-1.5 py-0.5 rounded bg-muted">Company stamp</span>}
            {r.requires_letterhead && <span className="px-1.5 py-0.5 rounded bg-muted">Letterhead</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function EvaluationTab({ master }: { master: any }) {
  const ev = master.evaluation?.evaluation_methodology ?? {};
  const dq = master.evaluation?.disqualification_rules ?? [];
  return (
    <div className="space-y-6 max-w-4xl">
      {ev.stage_1_administrative?.applicable && (
        <Collapsible title="Stage 1 — Administrative">
          <SimpleTable headers={["Criterion", "Mandatory", "Disqualifies", "Page"]}
            rows={(ev.stage_1_administrative.criteria ?? []).map((c: any) => [c.criterion, c.mandatory ? "Yes" : "No", c.disqualifies_if_failed ? "Yes" : "No", c.page_reference ?? "—"])} />
        </Collapsible>
      )}
      {ev.stage_2_functionality?.applicable && (
        <Collapsible title={`Stage 2 — Functionality (threshold ${ev.stage_2_functionality.minimum_threshold ?? "—"}${ev.stage_2_functionality.threshold_unit === "percentage" ? "%" : ""})`}>
          <SimpleTable headers={["Criterion", "Weight", "Max Pts", "Scoring Guide", "Page"]}
            rows={(ev.stage_2_functionality.criteria ?? []).map((c: any) => [c.criterion, c.weight ?? "—", c.maximum_points ?? "—", c.scoring_guide ?? "—", c.page_reference ?? "—"])} />
          {ev.stage_2_functionality.below_threshold_consequence && (
            <p className="text-xs text-destructive mt-3"><strong>Below threshold:</strong> {ev.stage_2_functionality.below_threshold_consequence}</p>
          )}
        </Collapsible>
      )}
      {ev.stage_3_price_and_preference?.applicable && (
        <Collapsible title={`Stage 3 — Price & Preference (${ev.stage_3_price_and_preference.pppfa_split ?? "—"})`}>
          <p className="text-sm mb-3"><strong>{ev.stage_3_price_and_preference.price_points ?? "—"}</strong> price points + <strong>{ev.stage_3_price_and_preference.preference_points ?? "—"}</strong> preference points</p>
          {ev.stage_3_price_and_preference.price_formula && <p className="text-xs text-muted-foreground mb-3">Formula: {ev.stage_3_price_and_preference.price_formula}</p>}
          <SimpleTable headers={["B-BBEE Level", "Points Awarded"]}
            rows={(ev.stage_3_price_and_preference.bbbee_points_table ?? []).map((t: any) => [t.bbbee_level, t.points_awarded])} />
        </Collapsible>
      )}
      {ev.stage_4_specific_goals?.applicable && (
        <Collapsible title="Stage 4 — Specific Goals">
          <SimpleTable headers={["Goal", "Points", "Requirements", "Page"]}
            rows={(ev.stage_4_specific_goals.goals ?? []).map((g: any) => [g.goal, g.points, g.requirements, g.page_reference])} />
        </Collapsible>
      )}
      {dq.length > 0 && (
        <div className="surface-card p-4 border-destructive/40 bg-destructive/5">
          <h3 className="text-sm font-bold text-destructive mb-2">Disqualification Rules</h3>
          <ul className="space-y-2 text-sm">
            {dq.map((r: any, i: number) => (
              <li key={i}><strong>{r.stage}:</strong> {r.rule} <span className="text-xs text-muted-foreground">→ {r.consequence}{r.page_reference ? ` · p.${r.page_reference}` : ""}</span></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PricingTab({ master }: { master: any }) {
  const p = master.pricing ?? {};
  return (
    <div className="space-y-6 max-w-5xl">
      {p.contract_value_estimate && (
        <div className="surface-card p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Contract Value Estimate</div>
          <div className="text-2xl font-extrabold">{p.contract_value_estimate}</div>
        </div>
      )}
      {p.pricing_instructions && (
        <div className="surface-card p-4 bg-brand-blue/5 border-brand-blue/30">
          <div className="text-xs uppercase tracking-wider text-brand-blue font-bold mb-1">Pricing Instructions</div>
          <p className="text-sm">{p.pricing_instructions}</p>
        </div>
      )}
      {(p.pricing_schedules ?? []).map((sch: any, i: number) => (
        <div key={i} className="surface-card p-4 overflow-x-auto">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="font-bold text-sm">{sch.schedule_name} <span className="text-xs text-muted-foreground ml-2">p.{sch.page_number}</span></h3>
            {sch.bidder_must_complete && <span className="text-[10px] px-2 py-0.5 rounded bg-orange-500/15 text-orange-600 font-bold">BIDDER TO COMPLETE</span>}
          </div>
          <table className="w-full text-xs">
            <thead><tr className="text-left text-muted-foreground border-b border-border">
              <th className="py-1 pr-2">Item</th><th className="py-1 pr-2">Description</th><th className="py-1 pr-2">Unit</th><th className="py-1 pr-2">Qty</th><th className="py-1 pr-2">Rate</th><th className="py-1 pr-2">Amount</th>
            </tr></thead>
            <tbody>
              {(sch.rows ?? []).map((r: any, j: number) => (
                <tr key={j} className="border-b border-border/50">
                  <td className="py-1.5 pr-2">{r.item_no}</td>
                  <td className="py-1.5 pr-2">{r.description}</td>
                  <td className="py-1.5 pr-2">{r.unit}</td>
                  <td className="py-1.5 pr-2">{r.quantity}</td>
                  <td className={`py-1.5 pr-2 ${r.rate_column === "BLANK" ? "text-muted-foreground italic" : ""}`}>{r.rate_column === "BLANK" ? "BIDDER TO COMPLETE" : r.rate_column}</td>
                  <td className={`py-1.5 pr-2 ${r.amount_column === "BLANK" ? "text-muted-foreground italic" : ""}`}>{r.amount_column === "BLANK" ? "BIDDER TO COMPLETE" : r.amount_column}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {p.BOQ?.present && (
        <div className="surface-card p-4">
          <h3 className="font-bold text-sm mb-2">Bill of Quantities</h3>
          <p className="text-xs text-muted-foreground">Pages: {(p.BOQ.pages ?? []).join(", ") || "—"} · {p.BOQ.total_items ?? 0} items</p>
          {p.BOQ.sections?.length > 0 && <ul className="text-sm mt-2 list-disc pl-5">{p.BOQ.sections.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>}
        </div>
      )}
      {(p.provisional_sums ?? []).length > 0 && (
        <div className="surface-card p-4">
          <h3 className="font-bold text-sm mb-2">Provisional Sums</h3>
          <SimpleTable headers={["Description", "Amount", "Page"]} rows={p.provisional_sums.map((s: any) => [s.description, s.amount, s.page_reference])} />
        </div>
      )}
    </div>
  );
}

function ContractTab({ master }: { master: any }) {
  const c = master.contract ?? {};
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="surface-card p-5">
        <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">Payment Terms</h3>
        <dl className="text-sm space-y-1.5">
          <Row k="Cycle" v={c.payment_terms?.payment_cycle} />
          <Row k="Period (days)" v={c.payment_terms?.payment_period_days} />
          <Row k="Retention %" v={c.payment_terms?.retention_percentage} />
          <Row k="Retention release" v={c.payment_terms?.retention_release_conditions} />
          <Row k="Late payment penalty" v={c.payment_terms?.penalty_for_late_payment} />
        </dl>
      </div>
      {(c.penalties_and_damages ?? []).length > 0 && (
        <div className="surface-card p-4">
          <h3 className="font-bold text-sm mb-3">Penalties & Damages</h3>
          <SimpleTable headers={["Type", "Rate", "Cap", "Trigger", "Page"]} rows={c.penalties_and_damages.map((p: any) => [p.type, p.rate, p.cap, p.trigger, p.page_reference])} />
        </div>
      )}
      {(c.insurance_requirements ?? []).length > 0 && (
        <div className="surface-card p-4">
          <h3 className="font-bold text-sm mb-3">Insurance Requirements</h3>
          <SimpleTable headers={["Type", "Minimum Cover", "Mandatory", "Notes", "Page"]} rows={c.insurance_requirements.map((i: any) => [i.type, i.minimum_cover, i.mandatory ? "Yes" : "No", i.notes, i.page_reference])} />
        </div>
      )}
      {c.subcontracting_rules && (
        <div className="surface-card p-5">
          <h3 className="font-bold text-sm mb-2">Subcontracting</h3>
          <dl className="text-sm space-y-1.5">
            <Row k="Allowed" v={c.subcontracting_rules.allowed ? "Yes" : "No"} />
            <Row k="Max %" v={c.subcontracting_rules.maximum_percentage} />
            <Row k="Client approval" v={c.subcontracting_rules.client_approval_required ? "Required" : "Not required"} />
          </dl>
        </div>
      )}
      {c.termination_clauses && (
        <div className="surface-card p-5">
          <h3 className="font-bold text-sm mb-2">Termination</h3>
          <p className="text-sm mb-2">{c.termination_clauses.summary}</p>
          <p className="text-xs text-muted-foreground">Notice period: {c.termination_clauses.notice_period ?? "—"}</p>
        </div>
      )}
      {c.dispute_resolution && (
        <div className="surface-card p-5">
          <h3 className="font-bold text-sm mb-2">Dispute Resolution</h3>
          <p className="text-sm font-medium mb-1">{c.dispute_resolution.method}</p>
          <p className="text-xs text-muted-foreground">{c.dispute_resolution.process}</p>
        </div>
      )}
      {(c.warranties_and_guarantees ?? []).length > 0 && (
        <div className="surface-card p-4">
          <h3 className="font-bold text-sm mb-3">Warranties</h3>
          <SimpleTable headers={["Type", "Duration", "Page"]} rows={c.warranties_and_guarantees.map((w: any) => [w.type, w.duration, w.page_reference])} />
        </div>
      )}
      {(c.special_conditions ?? []).length > 0 && (
        <div className="surface-card p-5">
          <h3 className="font-bold text-sm mb-2">Special Conditions</h3>
          <ul className="space-y-2 text-sm">
            {c.special_conditions.map((s: any, i: number) => (
              <li key={i}>• {s.condition} {s.page_reference && <span className="text-xs text-muted-foreground">· p.{s.page_reference}</span>}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PagesTab({ master }: { master: any }) {
  const pages: any[] = master.page_level_intelligence ?? [];
  const action = pages.filter((p) => p.action_required);
  const review = pages.filter((p) => p.review_flag);
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="surface-card p-4">
        <h3 className="font-bold text-sm mb-3">Pages Requiring Action ({action.length})</h3>
        {action.length === 0 ? <p className="text-sm text-muted-foreground">None.</p> :
          <SimpleTable headers={["Page", "Section", "Action", "Mandatory"]} rows={action.map((p) => [p.page, p.section_type, p.action, p.mandatory ? "Yes" : "No"])} />}
      </div>
      <div className="surface-card p-4">
        <h3 className="font-bold text-sm mb-3">Pages Requiring Manual Review ({review.length})</h3>
        {review.length === 0 ? <p className="text-sm text-muted-foreground">None.</p> :
          <SimpleTable headers={["Page", "Section", "Reason"]} rows={review.map((p) => [p.page, p.section_type, p.review_flag])} />}
      </div>
    </div>
  );
}

function MissingTab({ master }: { master: any }) {
  const m: any[] = master.missing_data ?? [];
  if (m.length === 0) return (
    <div className="surface-card p-8 text-center">
      <div className="text-success font-bold mb-2">✓ All data extracted successfully</div>
      <p className="text-sm text-muted-foreground">No fields were missing from the document.</p>
    </div>
  );
  return (
    <div className="surface-card p-4 max-w-4xl">
      <p className="text-sm text-muted-foreground mb-3">{m.length} field{m.length === 1 ? "" : "s"} could not be extracted.</p>
      <SimpleTable headers={["Field", "Source", "Page", "Reason"]} rows={m.map((x) => [x.field, x.source, x.page ?? "—", x.reason])} />
    </div>
  );
}

// ============================================================
// SHARED PRIMITIVES
// ============================================================
function Row({ k, v }: { k: string; v: any }) {
  if (v == null || v === "") return null;
  return <div className="flex justify-between gap-3"><dt className="text-muted-foreground shrink-0">{k}</dt><dd className="text-right font-medium break-words">{String(v)}</dd></div>;
}

function SimpleTable({ headers, rows }: { headers: string[]; rows: any[][] }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No data.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead><tr className="text-left text-muted-foreground border-b border-border">
          {headers.map((h) => <th key={h} className="py-1.5 pr-3 font-medium">{h}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/50">
              {r.map((c, j) => <td key={j} className="py-1.5 pr-3 align-top">{c == null || c === "" ? "—" : String(c)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Collapsible({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="surface-card overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full p-4 flex items-center justify-between hover:bg-surface-2/50">
        <h3 className="font-bold text-sm">{title}</h3>
        <span className="text-xs text-muted-foreground">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
