import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { runEligibility, type RiskLevel } from "@/lib/eligibility";
import { ArrowLeft, ClipboardCheck, AlertTriangle, Sparkles, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/eligibility/$docId")({
  component: EligibilityDoc,
});

const CREDITS = 2;
const riskStyle: Record<RiskLevel, string> = {
  CRITICAL: "bg-destructive text-destructive-foreground",
  HIGH: "bg-orange-500 text-white",
  MEDIUM: "bg-yellow-400 text-black",
  LOW: "bg-muted text-muted-foreground",
  INFO: "bg-muted text-muted-foreground",
};

function EligibilityDoc() {
  const { docId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [running, setRunning] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["eligibility-bundle", docId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [{ data: doc }, { data: profile }, { data: check }] = await Promise.all([
        supabase.from("documents").select("*").eq("id", docId).single(),
        supabase.from("company_profiles").select("*").eq("user_id", user!.id).maybeSingle(),
        supabase.from("eligibility_checks").select("*").eq("user_id", user!.id).eq("document_id", docId).maybeSingle(),
      ]);
      return { doc, profile, check };
    },
  });

  const { data: prof } = useQuery({
    queryKey: ["profile-credits", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("credits_remaining").eq("user_id", user!.id).single();
      return data;
    },
  });

  async function run() {
    if (!user || !data?.doc) return;
    if ((prof?.credits_remaining ?? 0) < CREDITS) {
      toast.error(`Insufficient credits — needs ${CREDITS}.`);
      return;
    }
    setRunning(true);
    try {
      const { data: ok, error } = await supabase.rpc("reserve_credits", { _user_id: user.id, _amount: CREDITS });
      if (error || !ok) throw new Error("Could not reserve credits");
      const master = (data.doc as any).master_result ?? null;
      if (!master) throw new Error("Document has no extraction result — re-process the document first.");
      const report = runEligibility(master, data.profile ?? {});
      await supabase.from("eligibility_checks").upsert({
        user_id: user.id,
        document_id: docId,
        result: report as any,
        overall_status: report.overall,
      }, { onConflict: "user_id,document_id" } as any);
      toast.success("Eligibility check complete");
      qc.invalidateQueries({ queryKey: ["eligibility-bundle", docId] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["profile-credits"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Eligibility check failed");
    } finally { setRunning(false); setConfirm(false); }
  }

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!data?.doc) return <div className="p-8">Document not found</div>;
  const master = (data.doc as any).master_result;
  const report = (data.check as any)?.result;

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto">
      <Link to="/documents/$id" params={{ id: docId }} className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground mb-3">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to document
      </Link>
      <div className="flex items-center gap-2 mb-1">
        <ClipboardCheck className="w-5 h-5 text-brand-teal" />
        <h1 className="text-3xl font-extrabold">Eligibility Check</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">{(data.doc as any).file_name}</p>

      {!data.profile && (
        <div className="surface-card p-5 mb-5 border-amber-500/30 bg-amber-500/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5" />
            <div>
              <div className="font-semibold mb-1">Complete your Company Profile first</div>
              <p className="text-sm text-muted-foreground mb-3">Eligibility comparison needs your CIDB grade, B-BBEE level and other details.</p>
              <Link to="/company-profile" className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold">Go to Company Profile</Link>
            </div>
          </div>
        </div>
      )}

      {!master && (
        <div className="surface-card p-5 mb-5 border-destructive/30 bg-destructive/5">
          <p className="text-sm">This document hasn't been processed. <Link to="/documents/$id" params={{ id: docId }} className="text-brand-blue hover:underline">Run extraction first</Link>.</p>
        </div>
      )}

      {master && (!report || confirm) && !running && (
        <div className="surface-card p-5 mb-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="font-semibold mb-1">{report ? "Re-run eligibility check" : "Run eligibility check"}</div>
              <p className="text-sm text-muted-foreground">Uses {CREDITS} credits. You have {prof?.credits_remaining ?? 0}.</p>
            </div>
            <button onClick={run} disabled={running || (prof?.credits_remaining ?? 0) < CREDITS}
              className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold inline-flex items-center gap-2 disabled:opacity-60">
              <Sparkles className="w-4 h-4" /> {running ? "Running…" : `Check My Eligibility · ${CREDITS} credits`}
            </button>
          </div>
        </div>
      )}
      {running && (
        <div className="surface-card p-8 text-center mb-5">
          <Loader2 className="w-8 h-8 text-brand-blue mx-auto animate-spin mb-2" />
          <p className="text-sm text-muted-foreground">Comparing requirements against your profile…</p>
        </div>
      )}

      {report && !running && (
        <>
          <div className="surface-card p-6 mb-5 text-center">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Overall Eligibility</div>
            <div className={`inline-block text-2xl font-extrabold px-6 py-3 rounded-2xl ${
              report.overall === "ELIGIBLE" ? "bg-success/15 text-success" :
              report.overall === "CONDITIONAL" ? "bg-yellow-400/15 text-yellow-500" :
              "bg-destructive/15 text-destructive"
            }`}>
              {report.overall === "ELIGIBLE" ? "Fully Eligible" : report.overall === "CONDITIONAL" ? "Conditionally Eligible" : "Not Eligible"}
            </div>
            <div className="flex gap-4 justify-center mt-4 text-xs flex-wrap">
              <span className="text-destructive font-semibold">{report.counts?.critical ?? 0} critical</span>
              <span className="text-orange-500 font-semibold">{report.counts?.high ?? 0} high</span>
              <span className="text-yellow-500 font-semibold">{report.counts?.medium ?? 0} medium</span>
            </div>
            <button onClick={() => setConfirm(true)} className="mt-4 text-xs text-brand-blue hover:underline">Re-run check</button>
          </div>

          {report.bbbee_table?.length > 0 && (
            <div className="surface-card p-5 mb-5">
              <h2 className="font-bold mb-3">B-BBEE Preference Points ({report.bbbee_split === "unknown" ? "assumed 90/10" : report.bbbee_split})</h2>
              <p className="text-sm text-muted-foreground mb-3">
                You score <span className="font-bold text-brand-teal">{report.bbbee_points_scored} out of {report.bbbee_points_max}</span> preference points.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-xs uppercase text-muted-foreground"><th className="text-left py-1.5">Level</th><th className="text-right">Points</th></tr></thead>
                  <tbody>
                    {report.bbbee_table.map((r: any, i: number) => (
                      <tr key={i} className={`border-t border-border ${r.yours ? "bg-brand-teal/10" : ""}`}>
                        <td className="py-1.5">{r.level}{r.yours && <span className="ml-2 text-[10px] text-brand-teal font-bold">YOU</span>}</td>
                        <td className="text-right font-mono">{r.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="surface-card p-5 mb-5">
            <h2 className="font-bold mb-3">Gap Analysis ({report.gaps?.length ?? 0})</h2>
            {!report.gaps?.length ? <p className="text-sm text-success">No gaps identified.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[800px]">
                  <thead className="text-xs uppercase text-muted-foreground">
                    <tr><th className="text-left py-2">Requirement</th><th className="text-left">Tender Requires</th><th className="text-left">You Have</th><th className="text-left">Gap</th><th className="text-left">Risk</th><th className="text-left">Page</th></tr>
                  </thead>
                  <tbody>
                    {report.gaps.map((g: any, i: number) => (
                      <tr key={i} className="border-t border-border align-top">
                        <td className="py-2 font-medium">{g.requirement}</td>
                        <td className="py-2 text-muted-foreground">{g.tender_requires}</td>
                        <td className="py-2 text-muted-foreground">{g.your_company_has}</td>
                        <td className="py-2">{g.gap}</td>
                        <td className="py-2"><span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${riskStyle[g.risk as RiskLevel] ?? "bg-muted"}`}>{g.risk}</span></td>
                        <td className="py-2 text-muted-foreground">{g.page_reference ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {report.recommendations?.length > 0 && (
            <div className="grid md:grid-cols-2 gap-3">
              {report.recommendations.map((r: any, i: number) => (
                <div key={i} className="surface-card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${riskStyle[r.risk as RiskLevel] ?? "bg-muted"}`}>{r.risk}</span>
                    <h3 className="font-semibold text-sm">{r.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{r.body}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
