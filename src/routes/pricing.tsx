import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingNav } from "@/components/MarketingNav";
import { MarketingFooter } from "@/components/MarketingFooter";
import { Check, X } from "lucide-react";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
  head: () => ({
    meta: [
      { title: "Pricing — ContractIQ SA" },
      { name: "description", content: "Simple, credit-based pricing for SA tender analysis. Free trial. Professional, Business and Enterprise plans." },
    ],
  }),
});

const plans = [
  {
    name: "Professional",
    price: "1,499",
    credits: "1,000 credits / month",
    features: [
      { v: true, t: "AI tender extraction" },
      { v: true, t: "OCR for scanned PDFs" },
      { v: true, t: "Up to 50MB per document" },
      { v: true, t: "Export to JSON" },
      { v: false, t: "REST API access" },
      { v: false, t: "Priority processing" },
    ],
    cta: "Start 14-Day Free Trial",
    highlight: false,
  },
  {
    name: "Business",
    price: "3,499",
    credits: "3,500 credits / month",
    features: [
      { v: true, t: "Everything in Professional" },
      { v: true, t: "Up to 200MB per document" },
      { v: true, t: "REST API access" },
      { v: true, t: "Team seats (up to 5)" },
      { v: true, t: "Priority processing" },
      { v: false, t: "Dedicated success manager" },
    ],
    cta: "Start 14-Day Free Trial",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "7,999",
    credits: "10,000 credits / month",
    features: [
      { v: true, t: "Everything in Business" },
      { v: true, t: "Unlimited team seats" },
      { v: true, t: "SA data residency" },
      { v: true, t: "Dedicated success manager" },
      { v: true, t: "SLA & POPIA agreement" },
      { v: true, t: "Custom integrations" },
    ],
    cta: "Contact Sales",
    highlight: false,
  },
];

function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />

      <section className="pt-32 pb-16 px-5 text-center relative overflow-hidden">
        <div className="absolute inset-0 hero-glow pointer-events-none" />
        <div className="relative max-w-3xl mx-auto">
          <div className="text-xs font-semibold uppercase tracking-widest text-brand-blue mb-3">Pricing</div>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4">Simple, credit-based pricing</h1>
          <p className="text-muted-foreground">Pay for what you process. Unused credits roll over each month. Cancel anytime.</p>
        </div>
      </section>

      <section className="px-5 pb-16">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-5">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`relative rounded-3xl p-8 border transition-all hover:-translate-y-1 ${
                p.highlight
                  ? "border-brand-blue bg-gradient-to-br from-brand-blue/10 to-surface-1 glow-blue-soft"
                  : "surface-card"
              }`}
            >
              {p.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-blue text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                  Most Popular
                </div>
              )}
              <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">{p.name}</div>
              <div className="font-display font-extrabold leading-none">
                <sup className="text-base font-medium align-top">R</sup>
                <span className="text-5xl">{p.price}</span>
                <sub className="text-sm font-normal text-muted-foreground align-baseline">/mo</sub>
              </div>
              <div className="text-brand-teal text-sm mt-3 mb-5">✦ {p.credits}</div>
              <div className="h-px bg-border my-5" />
              <ul className="space-y-2.5">
                {p.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    {f.v ? (
                      <Check className="w-4 h-4 text-success shrink-0 mt-0.5" />
                    ) : (
                      <X className="w-4 h-4 text-muted-foreground/40 shrink-0 mt-0.5" />
                    )}
                    <span className={f.v ? "" : "line-through opacity-60"}>{f.t}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/signup"
                className={`block text-center mt-7 px-4 py-3 rounded-xl font-display font-bold text-sm transition-all ${
                  p.highlight
                    ? "bg-primary text-primary-foreground glow-blue hover:scale-[1.02]"
                    : "border border-border text-foreground hover:border-brand-blue hover:text-brand-blue"
                }`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>

        <div className="max-w-3xl mx-auto text-center mt-12 text-sm text-muted-foreground">
          All plans include a 14-day free trial with 50 credits. Credit pricing: 1 credit per digital page, 2 per scanned page, 3 per complex page (tables/graphs). Payment processing via Stripe will be enabled in your next billing cycle.
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
