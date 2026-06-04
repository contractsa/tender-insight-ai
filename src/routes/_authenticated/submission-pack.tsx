import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PackageCheck, FileText, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/submission-pack")({
  component: SubmissionPackPage,
});

function SubmissionPackPage() {
  const { data: docs } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => (await supabase.from("documents").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const eligible = (docs ?? []).filter((d: any) => d.master_result);

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <PackageCheck className="w-5 h-5 text-brand-teal" />
        <h1 className="text-3xl font-extrabold">Submission Pack Builder</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">Pick a tender to generate an ordered submission checklist.</p>

      {!eligible.length ? (
        <div className="surface-card p-6 border-amber-500/30 bg-amber-500/5">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <div className="font-semibold text-foreground mb-1">No processed tenders yet</div>
              <Link to="/upload" className="text-brand-blue hover:underline">Upload a tender</Link> first.
            </div>
          </div>
        </div>
      ) : (
        <div className="surface-card divide-y divide-border">
          {eligible.map((d: any) => (
            <Link key={d.id} to="/submission-pack/$docId" params={{ docId: d.id }} className="flex items-center justify-between p-4 hover:bg-surface-2/50">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-5 h-5 text-brand-blue shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{d.file_name}</div>
                  <div className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleDateString()}</div>
                </div>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-brand-teal/15 text-brand-teal">Build pack →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
