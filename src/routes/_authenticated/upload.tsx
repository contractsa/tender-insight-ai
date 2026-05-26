import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { analyzeDocument } from "@/lib/analyze.functions";
import { Upload as UploadIcon, FileText, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/upload")({
  component: UploadPage,
});

function UploadPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const analyzeFn = useServerFn(analyzeDocument);
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string>("");

  function onPick(f: File | null) {
    if (!f) return;
    if (!f.type.includes("pdf") && !f.type.startsWith("image/")) {
      return toast.error("Please upload a PDF or image");
    }
    if (f.size > 20 * 1024 * 1024) {
      return toast.error("Max file size is 20MB for MVP");
    }
    setFile(f);
  }

  async function handleAnalyze() {
    if (!file || !user || busy) return;
    setBusy(true);
    let uploadedPath: string | null = null;
    try {
      setStage("Uploading…");
      const safeName = file.name.replace(/[^\w.-]/g, "_").slice(0, 120);
      const path = `${user.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (upErr) throw new Error(`Upload failed: ${upErr.message}`);
      uploadedPath = path;

      setStage("Creating record…");
      const { data: doc, error: docErr } = await supabase.from("documents").insert({
        user_id: user.id,
        file_name: file.name,
        file_size: file.size,
        file_path: path,
        mime_type: file.type,
        status: "uploaded",
      }).select().single();
      if (docErr || !doc) throw new Error(docErr?.message ?? "Could not save document record");

      // Hand off to the detail page — it auto-triggers analysis with polling
      // so the user can safely navigate away mid-analysis.
      toast.success("Upload complete. Starting analysis…");
      // Fire-and-forget: detail page will also auto-trigger if needed.
      analyzeFn({ data: { documentId: doc.id } }).catch(() => {});
      navigate({ to: "/documents/$id", params: { id: doc.id } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      toast.error(message);
      if (uploadedPath && message.includes("Could not save document record")) {
        await supabase.storage.from("documents").remove([uploadedPath]).catch(() => {});
      }
      setBusy(false);
      setStage("");
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-extrabold mb-1">Upload tender</h1>
      <p className="text-muted-foreground text-sm mb-8">PDF or image. Up to 20MB. ~3 credits per document.</p>

      <div
        onClick={() => !busy && inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); if (!busy) onPick(e.dataTransfer.files[0]); }}
        className={`surface-card p-12 text-center cursor-pointer border-2 border-dashed transition-all ${
          busy ? "opacity-60 cursor-wait" : "hover:border-brand-blue hover:bg-brand-blue/5"
        }`}
      >
        <input ref={inputRef} type="file" accept=".pdf,image/*" hidden onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
        {file ? (
          <div>
            <FileText className="w-12 h-12 text-brand-blue mx-auto mb-3" />
            <div className="font-semibold">{file.name}</div>
            <div className="text-xs text-muted-foreground mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
          </div>
        ) : (
          <div>
            <UploadIcon className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
            <div className="font-semibold mb-1">Drop your tender here</div>
            <div className="text-xs text-muted-foreground">or click to browse</div>
          </div>
        )}
      </div>

      {file && (
        <div className="mt-6 flex gap-3">
          <button
            onClick={handleAnalyze} disabled={busy}
            className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-display font-bold text-sm glow-blue-soft hover:glow-blue transition-all disabled:opacity-60 inline-flex items-center justify-center gap-2"
          >
            {busy ? (<><Loader2 className="w-4 h-4 animate-spin" /> {stage || "Working…"}</>) : "Analyse with AI →"}
          </button>
          {!busy && (
            <button onClick={() => setFile(null)} className="px-5 py-3 rounded-xl border border-border text-sm hover:border-destructive hover:text-destructive transition-colors">
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}
