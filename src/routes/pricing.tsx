import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MarketingNav } from "@/components/MarketingNav";
import { MarketingFooter } from "@/components/MarketingFooter";
import { Check } from "lucide-react";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
  head: () => ({
    meta: [
      { title: "Pricing — ContractIQ SA" },
      { name: "description", content: "Credit-based pricing for SA tender extraction. Starter, Professional, Business and Enterprise plans plus stackable top-ups." },
    ],
  }),
});

const plans = [
  {
    name: "Starter",
    price: "2,499",
    credits: "400 credits / month",
    bullets: ["~25–40 extractions / month", "Full 5-pass extraction", "Compliance checklist & returnables", "All download formats"],
    excludes: ["No eligibility matching", "No submission pack builder", "No tender monitoring"],
    best: "Small businesses bidding 3–6 tenders / month",
    highlight: false,
  },
  {
    name: "Professional",
    price: "5,999",
    credits: "1,200 credits / month",
    bullets: ["~75–120 extractions / month", "Everything in Starter", "Eligibility matching engine", "Submission pack builder with readiness gate", "Monitor up to 15 tenders", "Company profile system"],
    excludes: [],
    best: "Active bidders & consultants — 8–20 tenders / month",
    highlight: true,
  },
  {
    name: "Business",
    price: "12,999",
    credits: "3,500 credits / month",
    bullets: ["~220–350 extractions / month", "Everything in Professional", "Priority AI processing", "Unlimited tender monitoring", "API access", "Dedicated onboarding", "Multi-document pack support"],
    excludes: [],
    best: "Tender consultants, law firms, procurement teams managing 20+ tenders",
    highlight: false,
  },
  {
    name: "Enterprise",
    price: "24,999",
    credits: "10,000 credits / month",
    bullets: ["~600–1,000 extractions / month", "Everything in Business", "Dedicated account manager", "99.5% SLA", "Custom extraction templates", "Multi-user team access", "White-label reporting", "4-hour priority support"],
    excludes: [],
    best: "Large consulting firms managing tender portfolios",
    highlight: false,
  },
];

const topups = [
  { credits: "500", price: "1,799", save: "" },
  { credits: "1,500", price: "4,499", save: "Save 16%" },
  { credits: "4,000", price: "9,999", save: "Save 30% · Most popular" },
  { credits: "10,000", price: "19,999", save: "Save 42%" },
  { credits: "25,000", price: "39,999", save: "Save 55%" },
];

function PricingPage() {
  const [tenders, setTenders] = useState(8);
  const [pages, setPages] = useState(120);
  const [scanned, setScanned] = useState(20);

  const estimate = useMemo(() => {
    const scannedPages = Math.round(pages * (scanned / 100));
    const cleanPages = pages - scannedPages;
    const perTender = cleanPages * 1 + scannedPages * 2;
    const monthly = perTender * tenders;
    let rec = "Starter";
    if (monthly > 400) rec = "Professional";
    if (monthly > 1200) rec = "Business";
    if (monthly > 3500) rec = "Enterprise";
    return { monthly, rec };
  }, [tenders, pages, scanned]);

  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />

      <section className="pt-32 pb-12 px-5 text-center relative overflow-hidden">
        <div className="absolute inset-0 hero-glow pointer-events-none" />
        <div className="relative max-w-3xl mx-auto">
          <div className="text-xs font-semibold uppercase tracking-widest text-brand-blue mb-3">Pricing</div>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4">Plans for every tender pipeline</h1>
          <p className="text-muted-foreground">Monthly subscription plus stackable top-ups that never expire.</p>
        </div>
      </section>

      <section className="px-5 pb-12">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {plans.map((p) => (
            <div key={p.name} className={`relative rounded-3xl p-6 border transition-all hover:-translate-y-1 ${p.highlight ? "border-brand-blue bg-gradient-to-br from-brand-blue/10 to-surface-1 glow-blue-soft" : "surface-card"}`}>
              {p.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-blue text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">Most Popular</div>
              )}
              <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">{p.name}</div>
              <div className="font-display font-extrabold leading-none">
                <sup className="text-sm font-medium align-top">R</sup>
                <span className="text-4xl">{p.price}</span>
                <sub className="text-xs font-normal text-muted-foreground align-baseline">/mo</sub>
              </div>
              <div className="text-brand-teal text-xs mt-2 mb-4">✦ {p.credits}</div>
              <div className="h-px bg-border my-3" />
              <ul className="space-y-2 text-xs text-muted-foreground">
                {p.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2"><Check className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" /><span>{b}</span></li>
                ))}
              </ul>
              <div className="text-[11px] text-muted-foreground mt-4 italic">{p.best}</div>
              <Link to="/signup" className={`block text-center mt-5 px-4 py-2.5 rounded-xl font-display font-bold text-sm ${p.highlight ? "bg-primary text-primary-foreground glow-blue" : "border border-border text-foreground hover:border-brand-blue hover:text-brand-blue"}`}>
                Start free trial
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 pb-12">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-extrabold mb-4 text-center">Credit top-ups — never expire</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {topups.map((t) => (
              <div key={t.credits} className="surface-card p-4 text-center">
                <div className="text-2xl font-extrabold text-brand-teal">{t.credits}</div>
                <div className="text-xs text-muted-foreground mb-2">credits</div>
                <div className="text-lg font-bold">R{t.price}</div>
                {t.save && <div className="text-[10px] text-success mt-1">{t.save}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 pb-12">
        <div className="max-w-3xl mx-auto surface-card p-6">
          <h2 className="font-bold mb-2">Credit usage</h2>
          <ul className="text-sm text-muted-foreground space-y-1 mb-6">
            <li>• Clean digital PDF page — <span className="text-foreground font-semibold">1 credit</span></li>
            <li>• Scanned / image-based page — <span className="text-foreground font-semibold">2 credits</span></li>
            <li>• Page with complex tables, graphs or diagrams — <span className="text-foreground font-semibold">3 credits</span></li>
            <li>• Eligibility matching — <span className="text-foreground font-semibold">2 credits</span></li>
            <li>• Submission pack generation — <span className="text-foreground font-semibold">1 credit</span></li>
            <li>• Tender monitoring checks — <span className="text-success font-semibold">free</span> on Professional and above</li>
          </ul>

          <h3 className="font-bold mb-3">Credit calculator</h3>
          <div className="grid sm:grid-cols-3 gap-3 mb-4">
            <Number label="Tenders / month" value={tenders} onChange={setTenders} />
            <Number label="Avg pages / tender" value={pages} onChange={setPages} />
            <Number label="% scanned" value={scanned} onChange={setScanned} />
          </div>
          <div className="rounded-xl bg-surface-2 border border-border p-4 flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="text-xs text-muted-foreground">Estimated credits / month</div>
              <div className="text-2xl font-extrabold text-brand-teal">{estimate.monthly.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Recommended plan</div>
              <div className="text-lg font-bold text-brand-blue">{estimate.rec}</div>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

function Number({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input type="number" value={value} onChange={(e) => onChange(Math.max(0, Number(e.target.value)))} className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-2 border border-border text-sm focus:outline-none focus:border-brand-blue" />
    </label>
  );
}
