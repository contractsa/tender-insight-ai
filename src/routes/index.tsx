import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingNav } from "@/components/MarketingNav";
import { MarketingFooter } from "@/components/MarketingFooter";
import { ArrowRight, Upload, Brain, FileSearch, Download, Check } from "lucide-react";

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "ContractIQ SA — AI Tender & Contract Intelligence" },
      { name: "description", content: "Upload any SA tender, contract or RFQ. Get structured AI extraction — CIDB, B-BBEE, SBD, closing dates, key clauses — in seconds." },
    ],
  }),
});

const audiences = [
  { icon: "🏗️", title: "Contractors & Builders", body: "Instantly extract CIDB requirements, closing dates, and scope of work from government tenders." },
  { icon: "⚖️", title: "Law Firms", body: "Extract key clauses, penalty provisions, dispute resolution terms from commercial contracts." },
  { icon: "🏢", title: "Procurement Offices", body: "Evaluate multiple tenders fast. Extract evaluation criteria, mandatory docs, scoring." },
  { icon: "📋", title: "Compliance Teams", body: "Verify B-BBEE, SBD forms, SARS tax clearance and PFMA compliance from documents." },
  { icon: "💼", title: "SMEs & Consultants", body: "Process hundreds of tenders quickly to find the best opportunities — fast." },
  { icon: "🏛️", title: "Municipal Bidders", body: "Handle eThekwini, CoJ, City of Cape Town RFQs — all formats supported." },
];

const steps = [
  { n: "01", icon: Upload, title: "Upload Any SA Document", body: "Drag and drop any PDF — 1 page or 200 pages, digital or scanned, with graphs or handwriting." },
  { n: "02", icon: Brain, title: "AI Analyses It", body: "Our system reads every page with SA regulatory context built in — CIDB, B-BBEE, PFMA, NEC." },
  { n: "03", icon: FileSearch, title: "Structured Data Returned", body: "Reference numbers, closing dates, CIDB grades, B-BBEE levels, contact info — all extracted." },
  { n: "04", icon: Download, title: "Review & Export", body: "Export as JSON. Share with your team. Connect to your procurement system." },
];

const features = [
  { title: "SA Regulatory Context", body: "Trained on CIDB grades, B-BBEE levels, PPPFA, SBD forms, NEC contracts, PRASA/Transnet/Eskom templates." },
  { title: "OCR on Scanned Pages", body: "Detects scanned pages automatically and runs AI vision OCR — even on faxes and photocopies." },
  { title: "Confidence Scoring", body: "Every extracted field comes with a confidence score so you know exactly where to double-check." },
  { title: "Risk & Clause Detection", body: "Highlights penalty clauses, dispute resolution, payment terms and onerous obligations." },
  { title: "POPIA Compliant", body: "All documents encrypted at rest (AES-256) and in transit (TLS 1.3). We never train models on your data." },
  { title: "Bulk Processing", body: "Process up to 200MB documents. Mixed digital and scanned pages handled automatically." },
];

const faqs = [
  { q: "What types of South African documents does ContractIQ support?", a: "All PDF formats — government tenders, municipal RFQs and RFPs, PRASA/Transnet/Eskom tenders, NEC3/NEC4 contracts, CIDB documents, SBD forms, B-BBEE certificates, and private contracts. Digital or scanned." },
  { q: "How does the credit system work?", a: "Credits are charged per page based on complexity. Clean digital pages cost 1 credit. Scanned pages cost 2. Complex pages with tables cost 3. You see the full estimated cost before you confirm — no surprises." },
  { q: "Is my data secure? Are you POPIA compliant?", a: "Yes. All documents are encrypted at rest (AES-256) and in transit (TLS 1.3). Enterprise clients get SA data residency. We never train models on your documents. Fully POPIA compliant." },
  { q: "What happens when I run out of credits?", a: "Processing pauses and you're notified. You can buy a top-up instantly (top-ups never expire) or upgrade. Previously processed documents stay accessible forever." },
  { q: "What is your extraction accuracy?", a: "95–99% on digital documents and 88–95% on scanned. Every field includes a confidence score. SA-specific fields like CIDB grades, PPPFA scoring and SBD forms are extracted with specialist precision." },
];

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />

      {/* HERO */}
      <section className="relative min-h-[88vh] flex flex-col items-center justify-center text-center px-5 pt-24 pb-16 overflow-hidden">
        <div className="absolute inset-0 hero-glow pointer-events-none" />
        <div className="absolute inset-0 grid-bg pointer-events-none" />

        <div className="relative max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-brand-blue/10 border border-brand-blue/30 rounded-full px-4 py-1.5 text-xs text-brand-blue mb-6 animate-fade-up">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-teal animate-pulse-dot" />
            Built for South African procurement
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight max-w-3xl mx-auto mb-5 animate-fade-up-1">
            AI tender intelligence for{" "}
            <span className="text-gradient-brand">South Africa</span>
          </h1>

          <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto mb-9 animate-fade-up-2">
            Upload any procurement document — government tenders, municipal RFQs, NEC contracts, PRASA, Transnet — and get structured AI extraction in seconds.
          </p>

          <div className="flex flex-wrap gap-3 justify-center animate-fade-up-3">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-primary text-primary-foreground font-display font-bold glow-blue hover:scale-[1.02] transition-transform"
            >
              Start free trial <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl border border-border text-foreground font-display font-semibold hover:border-brand-blue hover:text-brand-blue transition-colors"
            >
              See pricing
            </Link>
          </div>

          <div className="mt-14 text-[11px] uppercase tracking-[0.12em] text-muted-foreground/70">
            Trusted by SA contractors, law firms & procurement teams
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="border-y border-border">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4">
          {[
            { v: "200MB", l: "Max document size", c: "text-brand-blue" },
            { v: "95–99%", l: "Extraction accuracy", c: "text-brand-teal" },
            { v: "< 60s", l: "Avg processing time", c: "text-brand-gold" },
            { v: "100%", l: "POPIA compliant", c: "text-success" },
          ].map((s) => (
            <div key={s.l} className="p-6 text-center border-r border-border last:border-r-0 odd:border-r md:odd:border-r">
              <div className={`font-display font-extrabold text-2xl md:text-3xl ${s.c}`}>{s.v}</div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* WHO */}
      <section className="py-20 px-5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="text-xs font-semibold uppercase tracking-widest text-brand-blue mb-3">Who it's for</div>
            <h2 className="text-3xl md:text-4xl font-extrabold mb-3">Built for the people who actually read tenders</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">From sole-trader contractors to enterprise procurement teams.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {audiences.map((a) => (
              <div key={a.title} className="surface-card p-5 hover:border-brand-blue/40 hover:-translate-y-0.5 transition-all">
                <div className="text-2xl mb-3">{a.icon}</div>
                <h4 className="font-bold text-sm mb-1.5">{a.title}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">{a.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW */}
      <section id="how" className="py-20 px-5 bg-surface-1/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="text-xs font-semibold uppercase tracking-widest text-brand-blue mb-3">How it works</div>
            <h2 className="text-3xl md:text-4xl font-extrabold mb-3">Upload. Analyse. Export.</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {steps.map((s) => (
              <div key={s.n} className="surface-card p-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-blue/20 to-brand-teal/10 border border-brand-blue/25 flex items-center justify-center font-display font-extrabold text-brand-blue mb-4">
                  {s.n}
                </div>
                <h4 className="font-bold text-sm mb-2">{s.title}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-20 px-5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="text-xs font-semibold uppercase tracking-widest text-brand-blue mb-3">Capabilities</div>
            <h2 className="text-3xl md:text-4xl font-extrabold mb-3">Specialist-level precision for SA procurement</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {features.map((f) => (
              <div key={f.title} className="surface-card p-6 hover:border-brand-teal/30 hover:-translate-y-0.5 transition-all">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-blue/15 to-brand-teal/10 border border-brand-blue/20 flex items-center justify-center mb-4">
                  <Check className="w-5 h-5 text-brand-teal" />
                </div>
                <h4 className="font-bold text-sm mb-2">{f.title}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 px-5 bg-surface-1/30">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <div className="text-xs font-semibold uppercase tracking-widest text-brand-blue mb-3">FAQ</div>
            <h2 className="text-3xl md:text-4xl font-extrabold">Questions, answered</h2>
          </div>
          <div className="space-y-2.5">
            {faqs.map((f, i) => (
              <details key={i} className="surface-card group">
                <summary className="cursor-pointer list-none p-5 flex items-center justify-between font-medium text-sm hover:text-brand-blue transition-colors">
                  {f.q}
                  <span className="text-muted-foreground group-open:rotate-180 transition-transform">▾</span>
                </summary>
                <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">{f.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-16">
        <div className="max-w-5xl mx-auto rounded-3xl p-12 text-center border border-brand-blue/25 bg-gradient-to-br from-brand-blue/10 to-brand-teal/5">
          <h2 className="text-3xl md:text-4xl font-extrabold mb-3">Start analysing tenders in 60 seconds</h2>
          <p className="text-muted-foreground mb-7">Free 14-day trial. 50 credits included. No card required.</p>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-primary text-primary-foreground font-display font-bold glow-blue hover:scale-[1.02] transition-transform"
          >
            Create free account <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
