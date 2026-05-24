import { Link } from "@tanstack/react-router";

export function MarketingFooter() {
  return (
    <footer className="border-t border-border py-9 px-5">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        <div className="text-xs text-muted-foreground">© {new Date().getFullYear()} ContractIQ South Africa. POPIA compliant.</div>
        <div className="flex flex-wrap gap-5 text-xs text-muted-foreground">
          <Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
          <a href="mailto:hello@contractiq.co.za" className="hover:text-foreground transition-colors">Contact</a>
          <span className="hover:text-foreground transition-colors cursor-pointer">Privacy</span>
          <span className="hover:text-foreground transition-colors cursor-pointer">Terms</span>
        </div>
      </div>
    </footer>
  );
}
