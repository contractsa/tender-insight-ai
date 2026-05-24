import { Link } from "@tanstack/react-router";
import { LogoLockup } from "./Logo";
import { useAuth } from "@/lib/auth-context";

export function MarketingNav() {
  const { user } = useAuth();
  return (
    <nav className="fixed top-0 inset-x-0 z-50 h-16 backdrop-blur-xl bg-background/85 border-b border-border">
      <div className="max-w-7xl mx-auto h-full px-5 flex items-center justify-between">
        <Link to="/"><LogoLockup /></Link>
        <div className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
          <Link to="/" hash="features" className="hover:text-foreground transition-colors">Features</Link>
          <Link to="/" hash="how" className="hover:text-foreground transition-colors">How it works</Link>
          <Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
          <Link to="/" hash="faq" className="hover:text-foreground transition-colors">FAQ</Link>
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <Link
              to="/dashboard"
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold glow-blue-soft hover:glow-blue transition-all"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">Sign In</Link>
              <Link
                to="/signup"
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold glow-blue-soft hover:glow-blue transition-all"
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
