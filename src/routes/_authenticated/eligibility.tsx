import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardCheck, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/eligibility")({
  component: EligibilityPage,
});

function EligibilityPage() {
  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <ClipboardCheck className="w-5 h-5 text-brand-teal" />
        <h1 className="text-3xl font-extrabold">Eligibility Matching</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Compare your company profile against tender requirements to identify gaps before you bid.
      </p>

      <div className="surface-card p-6 mb-5">
        <h2 className="font-bold mb-3">How it works</h2>
        <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
          <li>Complete your <Link to="/company-profile" className="text-brand-blue hover:underline">Company Profile</Link>.</li>
          <li>Open any processed tender from <Link to="/documents" className="text-brand-blue hover:underline">Documents</Link>.</li>
          <li>Click <span className="text-brand-teal font-semibold">Check My Eligibility</span> (2 credits).</li>
          <li>We compare every requirement (CIDB grade, B-BBEE, professional registrations, capacity) and produce a gap analysis.</li>
        </ol>
      </div>

      <div className="surface-card p-6 border-amber-500/30 bg-amber-500/5">
        <div className="flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <div className="font-semibold text-foreground mb-1">Open a tender to run eligibility</div>
            Eligibility runs in the context of a specific tender. Head to your documents list and open a processed tender to use this feature.
          </div>
        </div>
      </div>
    </div>
  );
}
