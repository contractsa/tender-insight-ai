import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { analyzeDocument } from "@/lib/analyze.functions";
import {
  ArrowLeft, FileText, AlertTriangle, Calendar, User, CheckCircle2, Loader2,
  RefreshCw, Sparkles, ClipboardList, Send, Scale, Table2, FileWarning,
  Phone, Mail, ChevronDown,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/documents/$id")({
  component: DocumentDetail,
});

type Contact = { role?: string | null; name?: string | null; email?: string | null; phone?: string | null; cell?: string | null; fax?: string | null; address?: string | null };
type Returnable = { name: string; category?: string | null; mandatory: boolean; page_reference?: string | null; notes?: string | null };
type Risk = { severity: "low" | "medium" | "high"; category?: string | null; description: string };
type DateItem = { date: string; time?: string | null; event: string; mandatory?: boolean | null; location?: string | null };
type Clause = { title: string; detail: string; page_reference?: string | null };
type DetectedTable = { page: string | number; type: string; title?: string | null; summary?: string | null };
type PageFlag = { page: string | number; reason: string };

function Section({ title, icon, defaultOpen = true, count, children }: { title: string; icon?: React.ReactNode; defaultOpen?: boolean; count?: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="surface-card overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-5 hover:bg-surface-2/50 transition-colors">
        <div className="flex items-center gap-2 font-display font-bold">
          {icon}
          <span>{title}</span>
          {typeof count === "number" && <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full ml-1">{count}</span>}
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

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
      toast.error(err instanceof Error ? err.message : "Analysis failed");
      qc.invalidateQueries({ queryKey: ["document", id] });
    } finally {
      setRunning(false);
    }
  }

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
  const a: any = analysis ?? {};
  const sub: any = a.submission_details ?? {};
  const evalC: any = a.evaluation_criteria ?? {};
  const contract: any = a.contract_intelligence ?? {};
  const contacts: Contact[] = (a.contact_info?.all ?? []) as Contact[];
  const returnables: Returnable[] = (a.returnables ?? []) as Returnable[];
  const tables: DetectedTable[] = (a.detected_tables ?? []) as DetectedTable[];
  const flagged: PageFlag[] = (a.pages_flagged ?? []) as PageFlag[];
  const dates: DateItem[] = (a.important_dates ?? []) as DateItem[];
  const risks: Risk[] = (a.risks ?? []) as Risk[];
  const clauses: Clause[] = (a.key_clauses ?? []) as Clause[];
  const compliance: string[] = (a.compliance_requirements ?? []) as string[];
  const closingDays = daysUntil(a.closing_date);

  const mandatoryReturnables = returnables.filter((r) => r.mandatory);
  const optionalReturnables = returnables.filter((r) => !r.mandatory);

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <Link to="/documents" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-5">
        <ArrowLeft className="w-4 h-4" /> Back to documents
      </Link>

      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <FileText className="w-8 h-8 text-brand-blue shrink-0 mt-1" />
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-extrabold break-words">
              {a.tender_title || doc.file_name}
            </h1>
            {a.tender_title && <p className="text-xs text-muted-foreground mt-0.5 truncate">{doc.file_name}</p>}
            <p className="text-sm text-muted-foreground mt-1">
              {new Date(doc.created_at).toLocaleString()} · {(doc.file_size / 1024 / 1024).toFixed(2)} MB
            </p>
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
          <div className="font-semibold mb-1">AI is performing deep procurement analysis…</div>
          <p className="text-sm text-muted-foreground">Extracting tender details, returnables, evaluation criteria, contract clauses, and risks. This can take 30–120 seconds for large bid packs. Safe to leave this page.</p>
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
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Sidebar */}
          <aside className="lg:col-span-1 space-y-4 lg:sticky lg:top-4 lg:self-start">
            <div className="surface-card p-5">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Quick Facts</div>
              <dl className="space-y-2.5 text-sm">
                {[
                  ["Reference", a.reference_number],
                  ["Issuer", a.issuing_entity],
                  ["Department", a.department],
                  ["Province", a.province],
                  ["Category", a.tender_category],
                  ["Procurement", a.procurement_type],
                  ["Closing", a.closing_date],
                  ["Value", a.estimated_value],
                  ["Duration", a.contract_duration],
                  ["CIDB", a.cidb_grade],
                  ["B-BBEE", a.bbbee_level],
                ].filter(([, v]) => v).map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3">
                    <dt className="text-muted-foreground shrink-0">{label}</dt>
                    <dd className="font-medium text-right truncate">{value as string}</dd>
                  </div>
                ))}
              </dl>
              {closingDays !== null && (
                <div className={`mt-4 p-3 rounded-lg text-center text-sm font-bold ${
                  closingDays < 0 ? "bg-muted text-muted-foreground" :
                  closingDays <= 3 ? "bg-destructive/15 text-destructive" :
                  closingDays <= 7 ? "bg-warning/15 text-warning" :
                  "bg-brand-blue/15 text-brand-blue"
                }`}>
                  {closingDays < 0 ? "Closed" : closingDays === 0 ? "Closes today" : `${closingDays} days to closing`}
                </div>
              )}
            </div>

            <div className="surface-card p-5">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">AI Scores</div>
              <div className="space-y-3">
                {typeof a.confidence_score === "number" && (
                  <div>
                    <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">Extraction confidence</span><span className="font-bold">{Math.round(a.confidence_score)}%</span></div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-brand-blue" style={{ width: `${a.confidence_score}%` }} /></div>
                  </div>
                )}
                {typeof a.readiness_score === "number" && (
                  <div>
                    <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">Submission readiness</span><span className="font-bold">{Math.round(a.readiness_score)}%</span></div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-success" style={{ width: `${a.readiness_score}%` }} /></div>
                  </div>
                )}
              </div>
            </div>
          </aside>

          {/* Main */}
          <div className="lg:col-span-2 space-y-4">
            {a.summary && (
              <Section title="Executive Summary" icon={<Sparkles className="w-4 h-4 text-brand-blue" />}>
                <p className="text-sm text-muted-foreground leading-relaxed">{a.summary}</p>
                {a.scope_of_work && (
                  <>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground mt-5 mb-2">Scope of Work</div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{a.scope_of_work}</p>
                  </>
                )}
              </Section>
            )}

            {dates.length > 0 && (
              <Section title="Key Deadlines" icon={<Calendar className="w-4 h-4 text-brand-blue" />} count={dates.length}>
                <div className="space-y-2.5">
                  {dates.map((d, i) => (
                    <div key={i} className="flex justify-between items-start gap-3 text-sm pb-2.5 border-b border-border last:border-b-0 last:pb-0">
                      <div className="min-w-0">
                        <div className="font-medium">{d.event} {d.mandatory && <span className="text-xs text-destructive ml-1">mandatory</span>}</div>
                        {d.location && <div className="text-xs text-muted-foreground mt-0.5">{d.location}</div>}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-medium text-brand-blue">{d.date}</div>
                        {d.time && <div className="text-xs text-muted-foreground">{d.time}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {risks.length > 0 && (
              <Section title="Risks & Disqualification Warnings" icon={<AlertTriangle className="w-4 h-4 text-warning" />} count={risks.length}>
                <div className="space-y-3">
                  {risks.map((r, i) => (
                    <div key={i} className="flex gap-3 items-start">
                      <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${
                        r.severity === "high" ? "bg-destructive/15 text-destructive" :
                        r.severity === "medium" ? "bg-warning/15 text-warning" :
                        "bg-muted text-muted-foreground"
                      }`}>{r.severity}</span>
                      <div className="text-sm">
                        {r.category && <div className="text-xs text-muted-foreground mb-0.5">{r.category}</div>}
                        <p className="text-muted-foreground">{r.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {returnables.length > 0 && (
              <Section title="Returnables Checklist" icon={<ClipboardList className="w-4 h-4 text-success" />} count={returnables.length}>
                {mandatoryReturnables.length > 0 && (
                  <>
                    <div className="text-xs uppercase tracking-wider text-destructive mb-2 font-semibold">Mandatory ({mandatoryReturnables.length})</div>
                    <ul className="space-y-1.5 mb-4">
                      {mandatoryReturnables.map((r, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <input type="checkbox" className="mt-1 accent-brand-blue" />
                          <div className="min-w-0 flex-1">
                            <span className="font-medium">{r.name}</span>
                            {r.category && <span className="text-xs text-muted-foreground ml-2">· {r.category}</span>}
                            {r.page_reference && <span className="text-xs text-muted-foreground ml-2">· p.{r.page_reference}</span>}
                            {r.notes && <div className="text-xs text-muted-foreground mt-0.5">{r.notes}</div>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {optionalReturnables.length > 0 && (
                  <>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 font-semibold">Optional ({optionalReturnables.length})</div>
                    <ul className="space-y-1.5">
                      {optionalReturnables.map((r, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <input type="checkbox" className="mt-1 accent-brand-blue" />
                          <div className="min-w-0 flex-1">
                            <span>{r.name}</span>
                            {r.page_reference && <span className="text-xs text-muted-foreground ml-2">· p.{r.page_reference}</span>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </Section>
            )}

            {(sub.mode || sub.physical_address || sub.portal || (sub.step_by_step?.length > 0)) && (
              <Section title="Submission Instructions" icon={<Send className="w-4 h-4 text-brand-blue" />}>
                <dl className="space-y-2 text-sm">
                  {[
                    ["Mode", sub.mode],
                    ["Portal", sub.portal],
                    ["Physical address", sub.physical_address],
                    ["Tender box", sub.tender_box],
                    ["Envelope marking", sub.envelope_marking],
                    ["Copies", sub.copies_required],
                    ["USB / CD", sub.usb_or_cd_required === true ? "Required" : sub.usb_or_cd_required === false ? "Not required" : null],
                    ["Courier", sub.courier_allowed === true ? "Allowed" : sub.courier_allowed === false ? "Not allowed" : null],
                    ["Late submissions", sub.late_submissions],
                  ].filter(([, v]) => v).map(([label, value]) => (
                    <div key={label as string} className="flex flex-col sm:flex-row sm:justify-between gap-1">
                      <dt className="text-muted-foreground shrink-0">{label}</dt>
                      <dd className="font-medium sm:text-right">{value as string}</dd>
                    </div>
                  ))}
                </dl>
                {Array.isArray(sub.step_by_step) && sub.step_by_step.length > 0 && (
                  <>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground mt-5 mb-2">Step by step</div>
                    <ol className="space-y-1.5 text-sm text-muted-foreground list-decimal list-inside">
                      {sub.step_by_step.map((s: string, i: number) => <li key={i}>{s}</li>)}
                    </ol>
                  </>
                )}
              </Section>
            )}

            {(evalC.preference_system || evalC.functionality_threshold || (evalC.functionality_criteria?.length > 0) || (evalC.pass_fail_requirements?.length > 0)) && (
              <Section title="Evaluation & Scoring" icon={<Scale className="w-4 h-4 text-brand-blue" />}>
                <dl className="space-y-2 text-sm mb-3">
                  {[
                    ["Preference system", evalC.preference_system],
                    ["Functionality threshold", evalC.functionality_threshold],
                    ["Price weighting", evalC.price_weighting],
                    ["B-BBEE weighting", evalC.bbbee_weighting],
                    ["Local content", evalC.local_content],
                    ["Methodology", evalC.methodology],
                  ].filter(([, v]) => v).map(([label, value]) => (
                    <div key={label as string} className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="font-medium text-right">{value as string}</dd>
                    </div>
                  ))}
                </dl>
                {Array.isArray(evalC.functionality_criteria) && evalC.functionality_criteria.length > 0 && (
                  <>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground mt-4 mb-2">Functionality criteria</div>
                    <table className="w-full text-sm">
                      <thead className="text-xs text-muted-foreground"><tr><th className="text-left pb-1.5">Criterion</th><th className="text-right pb-1.5">Weight</th><th className="text-right pb-1.5">Min</th></tr></thead>
                      <tbody>
                        {evalC.functionality_criteria.map((c: any, i: number) => (
                          <tr key={i} className="border-t border-border">
                            <td className="py-1.5">{c.criterion}</td>
                            <td className="py-1.5 text-right">{c.weight || "—"}</td>
                            <td className="py-1.5 text-right">{c.minimum || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
                {Array.isArray(evalC.pass_fail_requirements) && evalC.pass_fail_requirements.length > 0 && (
                  <>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground mt-4 mb-2">Pass / fail</div>
                    <ul className="space-y-1 text-sm text-muted-foreground list-disc list-inside">
                      {evalC.pass_fail_requirements.map((r: string, i: number) => <li key={i}>{r}</li>)}
                    </ul>
                  </>
                )}
              </Section>
            )}

            {compliance.length > 0 && (
              <Section title="Compliance Requirements" icon={<CheckCircle2 className="w-4 h-4 text-success" />} count={compliance.length} defaultOpen={false}>
                <ul className="space-y-2">
                  {compliance.map((c, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex gap-2"><span className="text-success">✓</span> {c}</li>
                  ))}
                </ul>
              </Section>
            )}

            {clauses.length > 0 && (
              <Section title="Key Clauses" count={clauses.length} defaultOpen={false}>
                <div className="space-y-3">
                  {clauses.map((c, i) => (
                    <div key={i} className="pb-3 border-b border-border last:border-b-0 last:pb-0">
                      <div className="flex justify-between gap-2 mb-1">
                        <div className="font-semibold text-sm">{c.title}</div>
                        {c.page_reference && <div className="text-xs text-muted-foreground shrink-0">p.{c.page_reference}</div>}
                      </div>
                      <div className="text-sm text-muted-foreground">{c.detail}</div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {Object.values(contract).some(Boolean) && (
              <Section title="Contract Intelligence" defaultOpen={false}>
                <dl className="space-y-2 text-sm">
                  {[
                    ["Contract form", contract.contract_form],
                    ["SLA", contract.sla],
                    ["Penalties", contract.penalties],
                    ["Retention", contract.retention],
                    ["Warranties", contract.warranties],
                    ["Guarantees", contract.guarantees],
                    ["Payment terms", contract.payment_terms],
                    ["Escalation", contract.escalation],
                    ["Liability", contract.liability],
                    ["Insurance", contract.insurance],
                    ["Subcontracting", contract.subcontracting],
                    ["Cancellation", contract.cancellation],
                    ["Dispute resolution", contract.dispute_resolution],
                  ].filter(([, v]) => v).map(([label, value]) => (
                    <div key={label as string} className="flex flex-col sm:flex-row sm:justify-between gap-1">
                      <dt className="text-muted-foreground shrink-0 sm:w-40">{label}</dt>
                      <dd className="font-medium flex-1 sm:text-right">{value as string}</dd>
                    </div>
                  ))}
                </dl>
              </Section>
            )}

            {tables.length > 0 && (
              <Section title="Detected Tables, Schedules & Graphs" icon={<Table2 className="w-4 h-4 text-brand-blue" />} count={tables.length} defaultOpen={false}>
                <div className="space-y-2.5">
                  {tables.map((t, i) => (
                    <div key={i} className="flex gap-3 items-start text-sm pb-2.5 border-b border-border last:border-b-0 last:pb-0">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-brand-blue/15 text-brand-blue shrink-0">p.{t.page}</span>
                      <div className="min-w-0">
                        <div className="font-medium">{t.title || t.type}</div>
                        {t.summary && <div className="text-xs text-muted-foreground mt-0.5">{t.summary}</div>}
                      </div>
                      <span className="text-xs text-muted-foreground ml-auto shrink-0">{t.type}</span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {contacts.length > 0 && (
              <Section title="Contact Directory" icon={<User className="w-4 h-4" />} count={contacts.length} defaultOpen={false}>
                <div className="space-y-3">
                  {contacts.map((c, i) => (
                    <div key={i} className="pb-3 border-b border-border last:border-b-0 last:pb-0 text-sm">
                      {c.role && <div className="text-xs text-muted-foreground mb-0.5">{c.role}</div>}
                      {c.name && <div className="font-semibold">{c.name}</div>}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-muted-foreground">
                        {c.email && <a href={`mailto:${c.email}`} className="text-brand-blue inline-flex items-center gap-1"><Mail className="w-3 h-3" /> {c.email}</a>}
                        {c.phone && <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1"><Phone className="w-3 h-3" /> {c.phone}</a>}
                        {c.cell && <a href={`tel:${c.cell}`} className="inline-flex items-center gap-1"><Phone className="w-3 h-3" /> {c.cell}</a>}
                        {c.fax && <span>Fax: {c.fax}</span>}
                      </div>
                      {c.address && <div className="text-xs text-muted-foreground mt-1">{c.address}</div>}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {flagged.length > 0 && (
              <Section title="Pages Flagged for Manual Review" icon={<FileWarning className="w-4 h-4 text-warning" />} count={flagged.length} defaultOpen={false}>
                <div className="space-y-2 text-sm">
                  {flagged.map((p, i) => (
                    <div key={i} className="flex gap-3 items-start">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-warning/15 text-warning shrink-0">p.{p.page}</span>
                      <p className="text-muted-foreground">{p.reason}</p>
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
