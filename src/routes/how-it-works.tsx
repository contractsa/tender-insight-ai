import { createFileRoute } from "@tanstack/react-router";
import { MarketingNav } from "@/components/MarketingNav";
import { MarketingFooter } from "@/components/MarketingFooter";
import { Upload, ScanSearch, ClipboardCheck, FileCheck, Radar, Download } from "lucide-react";

export const Route = createFileRoute("/how-it-works")({
  component: HowItWorksPage,
  head: () => ({
    meta: [
      { title: "How It Works — ContractIQ SA" },
      { name: "description", content: "Six steps from upload to submission-ready: AI extraction, eligibility matching, submission pack and monitoring." },
    ],
  }),
});

const steps = [
  { icon: Upload, title: "1. Upload the tender", body: "Drop the RFP PDF — digital or scanned. Up to 200MB on Business plans." },
  { icon: ScanSearch, title: "2. AI extraction", body: "Five Gemini passes extract submission details, returnables, evaluation, pricing and contract terms with page references." },
  { icon: ClipboardCheck, title: "3. Eligibility check", body: "Compare your company profile against every requirement (CIDB, B-BBEE, professional registrations, capacity) and see your gaps." },
  { icon: FileCheck, title: "4. Submission pack", body: "Get an ordered, signature-aware checklist with Commissioner of Oaths, witness and stamp requirements per item." },
  { icon: Radar, title: "5. Monitor", body: "Track closing dates and addenda for every tender you're watching." },
  { icon: Download, title: "6. Download", body: "Export the full report, returnables checklist, submission pack, JSON or CSV — all ContractIQ-branded." },
];

function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />
      <section className="pt-32 pb-12 px-5 text-center relative overflow-hidden">
        <div className="absolute inset-0 hero-glow pointer-events-none" />
        <div className="relative max-w-3xl mx-auto">
          <div className="text-xs font-semibold uppercase tracking-widest text-brand-blue mb-3">How It Works</div>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4">From PDF to bid-ready in minutes</h1>
          <p className="text-muted-foreground">ContractIQ SA reads every page of an SA government tender and gives you submission-grade intelligence.</p>
        </div>
      </section>
      <section className="px-5 pb-20">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-5">
          {steps.map((s) => (
            <div key={s.title} className="surface-card p-6">
              <s.icon className="w-6 h-6 text-brand-teal mb-3" />
              <h3 className="font-bold mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </section>
      <MarketingFooter />
    </div>
  );
}
