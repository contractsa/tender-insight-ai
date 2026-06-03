import { createFileRoute, Link } from "@tanstack/react-router";
import { PackageCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/submission-pack")({
  component: SubmissionPackPage,
});

function SubmissionPackPage() {
  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <PackageCheck className="w-5 h-5 text-brand-teal" />
        <h1 className="text-3xl font-extrabold">Submission Pack Builder</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Generate an ordered, signature-aware submission checklist for any tender.
      </p>

      <div className="surface-card p-6">
        <h2 className="font-bold mb-3">Build a pack</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Open a processed tender from <Link to="/documents" className="text-brand-blue hover:underline">Documents</Link> and click
          <span className="text-brand-teal font-semibold"> Build Submission Pack</span> (1 credit). You'll get an ordered checklist with signature, initials, Commissioner of Oaths, witness and stamp requirements per item, plus a readiness gate before download.
        </p>
      </div>
    </div>
  );
}
