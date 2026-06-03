import { createFileRoute } from "@tanstack/react-router";
import { MarketingNav } from "@/components/MarketingNav";
import { MarketingFooter } from "@/components/MarketingFooter";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({ meta: [{ title: "Privacy Policy — ContractIQ SA" }, { name: "description", content: "How ContractIQ SA handles your data." }] }),
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />
      <section className="pt-32 pb-20 px-5">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-extrabold mb-6">Privacy Policy</h1>
          <div className="space-y-4 text-sm text-muted-foreground">
            <Section title="Encryption">All uploaded documents are encrypted in transit (TLS 1.2+) and at rest.</Section>
            <Section title="No third-party sharing">We do not share your documents or extracted data with any third party, ever.</Section>
            <Section title="No AI training">Your documents are never used to train AI models — ours or any provider's.</Section>
            <Section title="Retention">Documents and extracted results are retained for 90 days, then automatically deleted.</Section>
            <Section title="Deletion on request">You can request deletion of all your data at any time by emailing <a className="text-brand-blue" href="mailto:privacy@contractiq.co.za">privacy@contractiq.co.za</a>.</Section>
            <Section title="Contact">Privacy queries: <a className="text-brand-blue" href="mailto:privacy@contractiq.co.za">privacy@contractiq.co.za</a></Section>
          </div>
        </div>
      </section>
      <MarketingFooter />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="surface-card p-5">
      <h2 className="font-bold text-foreground mb-1">{title}</h2>
      <div>{children}</div>
    </div>
  );
}
