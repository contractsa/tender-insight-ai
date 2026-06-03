import { createFileRoute } from "@tanstack/react-router";
import { MarketingNav } from "@/components/MarketingNav";
import { MarketingFooter } from "@/components/MarketingFooter";

export const Route = createFileRoute("/about")({
  component: AboutPage,
  head: () => ({
    meta: [
      { title: "About — ContractIQ SA" },
      { name: "description", content: "ContractIQ SA helps South African businesses bid with confidence on government tenders." },
    ],
  }),
});

function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />
      <section className="pt-32 pb-20 px-5">
        <div className="max-w-3xl mx-auto">
          <div className="text-xs font-semibold uppercase tracking-widest text-brand-blue mb-3">About</div>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-6">Built for South African procurement.</h1>
          <div className="prose prose-invert space-y-4 text-muted-foreground">
            <p>ContractIQ SA exists because a single missed returnable can cost a business a multi-million-rand contract. We help SMMEs, contractors and consultants extract every piece of submission-critical intelligence from SA government tenders — fast, accurately and with page-level references you can verify.</p>
            <p>We're built around real PFMA, MFMA, CIDB, B-BBEE and PPPFA workflows. The platform understands SBD and MBD forms, briefing requirements, Commissioner of Oaths obligations, and the order documents must appear in your submission pack.</p>
            <p>Our mission: make it impossible to be disqualified by paperwork.</p>
          </div>
        </div>
      </section>
      <MarketingFooter />
    </div>
  );
}
