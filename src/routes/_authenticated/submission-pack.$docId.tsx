import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { downloadSubmissionPackPDF } from "@/lib/pdf-reports";
import { ArrowLeft, PackageCheck, AlertTriangle, Download, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/submission-pack/$docId")({
  component: SubmissionPackDoc,
});

const CREDITS = 1;
type Status = "complete" | "pending" | "na";

function orderItems(master: any): any[] {
  const rets: any[] = master?.returnables?.returnables ?? [];
  const compl: any[] = master?.compliance_checklist ?? master?.submission?.mandatory_compliance_documents ?? [];
  const items: any[] = [];
  const seen = new Set<string>();
  const push = (it: any, source: string) => {
    const key = `${it.name}|${it.page_number ?? it.page ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ ...it, _source: source });
  };
  const num = (s: string) => parseInt(String(s).match(/\d+/)?.[0] ?? "999", 10);
  const sbd = rets.filter((r) => r?.form_type === "SBD").sort((a, b) => num(a.name) - num(b.name));
  const mbd = rets.filter((r) => r?.form_type === "MBD").sort((a, b) => num(a.name) - num(b.name));
  sbd.forEach((r) => push(r, "SBD"));
  mbd.forEach((r) => push(r, "MBD"));
  const certOrder = ["Tax Compliance", "CIPC", "B-BBEE", "CIDB", "COIDA", "Municipal", "Professional"];
  for (const c of certOrder) {
    compl.filter((d: any) => new RegExp(c, "i").test(d.document_name ?? d.name ?? "")).forEach((d) => push({
      name: d.document_name ?? d.name, page_number: d.page_reference ?? d.page,
      mandatory: d.mandatory, disqualifies_if_missing: d.disqualifies_if_missing,
    }, "Compliance"));
  }
  const remaining = rets.filter((r) => !["SBD", "MBD"].includes(r?.form_type ?? "")).sort((a, b) => (a.page_number ?? 999) - (b.page_number ?? 999));
  remaining.forEach((r) => push(r, "Other"));
  return items;
}

function useCountdown(deadlineStr?: string | null, timeStr?: string | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t); }, []);
  if (!deadlineStr) return null;
  const dt = new Date(`${deadlineStr} ${timeStr ?? ""}`.trim());
  if (isNaN(dt.getTime())) return null;
  const diff = dt.getTime() - now;
  if (diff <= 0) return { closed: true, days: 0, hours: 0, minutes: 0 };
  return {
    closed: false,
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
  };
}

function SubmissionPackDoc() {
  const { docId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);

  const { data } = useQuery({
    queryKey: ["pack-bundle", docId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [{ data: doc }, { data: pack }, { data: prof }] = await Promise.all([
        supabase.from("documents").select("*").eq("id", docId).single(),
        supabase.from("submission_packs").select("*").eq("user_id", user!.id).eq("document_id", docId).maybeSingle(),
        supabase.from("profiles").select("credits_remaining").eq("user_id", user!.id).single(),
      ]);
      return { doc, pack, prof };
    },
  });

  const master = (data?.doc as any)?.master_result;
  const items = useMemo(() => orderItems(master ?? {}), [master]);
  const savedItems: any[] = (data?.pack as any)?.checklist_items ?? [];
  const [statuses, setStatuses] = useState<Record<string, Status>>({});

  useEffect(() => {
    if (savedItems.length) {
      const map: Record<string, Status> = {};
      savedItems.forEach((it: any, i: number) => { map[`${it.name}|${i}`] = it.status ?? "pending"; });
      setStatuses(map);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.pack?.id]);

  const sub = master?.submission?.submission ?? {};
  const countdown = useCountdown(sub?.closing_date, sub?.closing_time);

  async function generate() {
    if (!user || !master) return;
    if (data?.pack) return; // already generated
    if ((data?.prof as any)?.credits_remaining < CREDITS) { toast.error("Insufficient credits"); return; }
    const { data: ok } = await supabase.rpc("reserve_credits", { _user_id: user.id, _amount: CREDITS });
    if (!ok) { toast.error("Could not reserve credits"); return; }
    await supabase.from("submission_packs").upsert({
      user_id: user.id, document_id: docId, checklist_items: items as any, overall_status: "in_progress",
    }, { onConflict: "user_id,document_id" } as any);
    toast.success("Submission pack created");
    qc.invalidateQueries({ queryKey: ["pack-bundle", docId] });
  }

  async function saveStatuses(next: Record<string, Status>) {
    if (!user) return;
    const enriched = items.map((it: any, i: number) => ({ ...it, status: next[`${it.name}|${i}`] ?? "pending" }));
    await supabase.from("submission_packs").update({ checklist_items: enriched as any }).eq("user_id", user.id).eq("document_id", docId);
  }

  function setStatus(key: string, s: Status) {
    const next = { ...statuses, [key]: s };
    setStatuses(next);
    saveStatuses(next);
  }

  if (!data) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!data.doc) return <div className="p-8">Not found</div>;

  const mandatoryItems = items.filter((it) => it.mandatory);
  const completeCount = mandatoryItems.filter((it, i) => {
    const key = `${it.name}|${items.indexOf(it)}`;
    return statuses[key] === "complete" || statuses[key] === "na";
  }).length;
  const readiness = mandatoryItems.length ? Math.round((completeCount / mandatoryItems.length) * 100) : 0;
  const pendingCount = mandatoryItems.length - completeCount;
  const naCount = items.filter((it, i) => statuses[`${it.name}|${items.indexOf(it)}`] === "na").length;
  const canSubmit = pendingCount === 0;

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto pb-24">
      <Link to="/documents/$id" params={{ id: docId }} className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground mb-3">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to document
      </Link>
      <div className="flex items-center gap-2 mb-1">
        <PackageCheck className="w-5 h-5 text-brand-teal" />
        <h1 className="text-3xl font-extrabold">Submission Pack</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">{(data.doc as any).file_name}</p>

      {!master && (
        <div className="surface-card p-5 border-destructive/30 bg-destructive/5">
          <p className="text-sm">No extraction result. <Link to="/documents/$id" params={{ id: docId }} className="text-brand-blue hover:underline">Run extraction first</Link>.</p>
        </div>
      )}

      {master && !data.pack && (
        <div className="surface-card p-5 mb-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="font-semibold mb-1">Build submission pack</div>
              <p className="text-sm text-muted-foreground">Generates ordered checklist with {items.length} items. Uses {CREDITS} credit.</p>
            </div>
            <button onClick={generate} className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold">
              Build Submission Pack · {CREDITS} credit
            </button>
          </div>
        </div>
      )}

      {master && data.pack && (
        <>
          {countdown && (
            <div className="surface-card p-4 mb-4 sticky top-14 md:top-0 z-10 bg-surface-1/95 backdrop-blur">
              <div className="flex items-center gap-3">
                <Clock className={`w-5 h-5 ${countdown.closed ? "text-muted-foreground" : countdown.days <= 3 ? "text-destructive" : countdown.days <= 7 ? "text-orange-500" : "text-brand-teal"}`} />
                <div className="flex-1">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Closing</div>
                  <div className={`text-xl font-extrabold ${countdown.closed ? "text-muted-foreground" : countdown.days <= 3 ? "text-destructive" : countdown.days <= 7 ? "text-orange-500" : ""}`}>
                    {countdown.closed ? "Closed" : `${countdown.days}d ${countdown.hours}h ${countdown.minutes}m`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Readiness</div>
                  <div className="text-xl font-extrabold text-brand-teal">{readiness}%</div>
                </div>
              </div>
              <div className="mt-2 w-full h-2 bg-surface-2 rounded-full overflow-hidden">
                <div className="h-full bg-brand-teal transition-all" style={{ width: `${readiness}%` }} />
              </div>
            </div>
          )}

          <div className="space-y-3 mb-6">
            {items.map((it: any, i: number) => {
              const key = `${it.name}|${i}`;
              const s = statuses[key] ?? "pending";
              return (
                <div key={key} className="surface-card p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-mono text-muted-foreground">#{i + 1}</span>
                        <h3 className="font-bold text-base">{it.name}</h3>
                      </div>
                      <div className="text-xs text-brand-teal font-semibold mb-2">{it.page_number ? `Page ${it.page_number}` : ""}</div>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {it.mandatory && <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-destructive/15 text-destructive">Mandatory</span>}
                        {it.disqualifies_if_missing && <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-destructive text-destructive-foreground inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Disqualifies if missing</span>}
                        {it.requires_signature && <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-brand-blue/15 text-brand-blue">Signature</span>}
                        {it.requires_initials && <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-brand-blue/15 text-brand-blue">Initials every page</span>}
                        {it.requires_commissioner_of_oaths && <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-orange-500/15 text-orange-500">Commissioner of Oaths</span>}
                        {it.requires_company_stamp && <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-muted">Company stamp</span>}
                        {it.requires_witness && <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-muted">Witness required</span>}
                        {it.requires_original && <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-muted">Original</span>}
                        {it.requires_certified_copy && <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-muted">Certified copy</span>}
                      </div>
                      {Array.isArray(it.fields_to_complete) && it.fields_to_complete.length > 0 && (
                        <ul className="text-xs text-muted-foreground list-disc list-inside mb-2 space-y-0.5">
                          {it.fields_to_complete.slice(0, 6).map((f: string, j: number) => <li key={j}>{f}</li>)}
                        </ul>
                      )}
                      {it.purpose && <p className="text-xs text-muted-foreground">{it.purpose}</p>}
                      {it.notes && <div className="mt-2 text-xs p-2 rounded bg-yellow-500/10 text-yellow-700 dark:text-yellow-300">⚠ {it.notes}</div>}
                    </div>
                    <select value={s} onChange={(e) => setStatus(key, e.target.value as Status)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold shrink-0 ${
                        s === "complete" ? "bg-success/15 text-success border-success/40" :
                        s === "na" ? "bg-muted text-muted-foreground border-border" :
                        "bg-yellow-400/15 text-yellow-600 border-yellow-400/40"
                      }`}>
                      <option value="pending">Pending</option>
                      <option value="complete">Complete</option>
                      <option value="na">Not applicable</option>
                    </select>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="surface-card p-5 border-brand-teal/30">
            <h2 className="font-bold mb-3">Submission Readiness Gate</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 text-center">
              <div><div className="text-2xl font-bold">{mandatoryItems.length}</div><div className="text-xs text-muted-foreground">Mandatory</div></div>
              <div><div className="text-2xl font-bold text-success">{completeCount}</div><div className="text-xs text-muted-foreground">Complete</div></div>
              <div><div className="text-2xl font-bold text-yellow-500">{pendingCount}</div><div className="text-xs text-muted-foreground">Pending</div></div>
              <div><div className="text-2xl font-bold text-muted-foreground">{naCount}</div><div className="text-xs text-muted-foreground">N/A</div></div>
            </div>
            <label className={`flex items-start gap-2 text-sm mb-4 ${canSubmit ? "" : "opacity-50"}`}>
              <input type="checkbox" disabled={!canSubmit} checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-1" />
              <span>I confirm that all documents listed above are correctly completed, properly signed, commissioned where required, and ready for submission in the correct order.</span>
            </label>
            <button
              disabled={!canSubmit || !confirm}
              onClick={() => downloadSubmissionPackPDF(items, master, { file_name: (data.doc as any).file_name })}
              className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
              <Download className="w-4 h-4" /> Download Submission Checklist PDF
            </button>
          </div>
        </>
      )}
    </div>
  );
}
