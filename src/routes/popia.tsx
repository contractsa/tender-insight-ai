import { createFileRoute } from "@tanstack/react-router";
import { MarketingNav } from "@/components/MarketingNav";
import { MarketingFooter } from "@/components/MarketingFooter";

export const Route = createFileRoute("/popia")({
  component: PopiaPage,
  head: () => ({ meta: [{ title: "POPIA Compliance — ContractIQ SA" }, { name: "description", content: "Our commitments under the Protection of Personal Information Act." }] }),
});

const rights = [
  "Right to be notified of personal information collection.",
  "Right to access your personal information.",
  "Right to correct, destroy or delete personal information.",
  "Right to object to processing.",
  "Right to object to direct marketing.",
  "Right to complain to the Information Regulator.",
  "Right to institute civil proceedings.",
];

function PopiaPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />
      <section className="pt-32 pb-20 px-5">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-extrabold mb-6">POPIA Compliance</h1>
          <p className="text-sm text-muted-foreground mb-6">
            ContractIQ SA processes personal information in accordance with the Protection of Personal Information Act, 4 of 2013 (POPIA).
          </p>

          <div className="surface-card p-5 mb-5">
            <h2 className="font-bold mb-3">Your rights</h2>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {rights.map((r) => <li key={r}>{r}</li>)}
            </ul>
          </div>

          <div className="surface-card p-5">
            <h2 className="font-bold mb-1">Information Officer</h2>
            <p className="text-sm text-muted-foreground">
              Email <a className="text-brand-blue" href="mailto:popia@contractiq.co.za">popia@contractiq.co.za</a>. We respond to all POPIA requests within 30 days.
            </p>
          </div>
        </div>
      </section>
      <MarketingFooter />
    </div>
  );
}
