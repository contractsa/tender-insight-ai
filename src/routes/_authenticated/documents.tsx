import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/documents")({
  component: DocumentsList,
});

function DocumentsList() {
  const { data: docs, isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const { data } = await supabase.from("documents").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

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
          {docs.map((d) => (
            <Link key={d.id} to="/documents/$id" params={{ id: d.id }} className="flex items-center justify-between p-4 hover:bg-surface-2/50 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-5 h-5 text-brand-blue shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{d.file_name}</div>
                  <div className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleString()} · {(d.file_size / 1024 / 1024).toFixed(2)} MB</div>
                </div>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full shrink-0 ml-2 ${
                d.status === "completed" ? "bg-success/15 text-success" :
                d.status === "processing" ? "bg-brand-blue/15 text-brand-blue" :
                d.status === "failed" ? "bg-destructive/15 text-destructive" :
                "bg-muted text-muted-foreground"
              }`}>{d.status}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
