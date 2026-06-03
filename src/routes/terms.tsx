import { createFileRoute } from "@tanstack/react-router";
import { MarketingNav } from "@/components/MarketingNav";
import { MarketingFooter } from "@/components/MarketingFooter";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({ meta: [{ title: "Terms of Service — ContractIQ SA" }, { name: "description", content: "Terms of use for the ContractIQ SA platform." }] }),
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />
      <section className="pt-32 pb-20 px-5">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-extrabold mb-6">Terms of Service</h1>
          <div className="space-y-4 text-sm text-muted-foreground">
            <Block title="Service provided as-is">
              ContractIQ SA is provided as-is. We work hard to extract accurate information, but bidders must independently verify every field against the source tender before submission.
            </Block>
            <Block title="Credit refund policy">
              Credits are automatically refunded when extraction fails due to a system error (rate limit, timeout, infrastructure fault). Credits consumed by successful extractions are non-refundable.
            </Block>
            <Block title="User responsibility">
              You are solely responsible for the accuracy, completeness and timeliness of your bid submission. ContractIQ SA is an analytical tool, not a substitute for professional bid management.
            </Block>
            <Block title="Liability limit">
              Our maximum aggregate liability is limited to the fees paid by you to ContractIQ SA in the 12 months preceding the claim.
            </Block>
            <Block title="Governing law and jurisdiction">
              These terms are governed by the laws of the Republic of South Africa. Any dispute is subject to the exclusive jurisdiction of the High Court of South Africa, Gauteng Division.
            </Block>
          </div>
        </div>
      </section>
      <MarketingFooter />
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="surface-card p-5">
      <h2 className="font-bold text-foreground mb-1">{title}</h2>
      <div>{children}</div>
    </div>
  );
}
