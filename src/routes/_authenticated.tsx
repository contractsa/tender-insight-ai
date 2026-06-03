import { createFileRoute, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { LogoLockup } from "@/components/Logo";
import { LayoutDashboard, Upload, FileText, User, LogOut, Menu, X, Building2, ClipboardCheck, PackageCheck, Radar, CreditCard, HelpCircle, Info, Shield, ScrollText, FileCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }

  const navItems = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/upload", label: "Upload Documents", icon: Upload },
    { to: "/documents", label: "Documents", icon: FileText },
    { to: "/company-profile", label: "Company Profile", icon: Building2 },
    { to: "/eligibility", label: "Eligibility", icon: ClipboardCheck },
    { to: "/submission-pack", label: "Submission Pack", icon: PackageCheck },
    { to: "/monitoring", label: "Monitored Tenders", icon: Radar },
    { to: "/pricing", label: "Pricing", icon: CreditCard },
    { to: "/how-it-works", label: "How It Works", icon: HelpCircle },
    { to: "/about", label: "About", icon: Info },
    { to: "/privacy", label: "Privacy", icon: Shield },
    { to: "/popia", label: "POPIA", icon: FileCheck },
    { to: "/terms", label: "Terms", icon: ScrollText },
    { to: "/account", label: "Account", icon: User },
  ];

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 inset-x-0 z-40 h-14 flex items-center justify-between px-4 border-b border-border bg-surface-1/95 backdrop-blur">
        <Link to="/"><LogoLockup /></Link>
        <button
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
          className="p-2 rounded-md hover:bg-surface-2 transition-colors"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="md:hidden fixed inset-0 z-40 bg-background/70 backdrop-blur-sm top-14"
        />
      )}

      <aside
        className={`w-60 shrink-0 border-r border-border bg-surface-1 flex flex-col fixed inset-y-0 left-0 z-50 transition-transform duration-200
          md:translate-x-0
          ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
          top-14 md:top-0`}
      >
        <div className="hidden md:block p-5 border-b border-border">
          <Link to="/"><LogoLockup /></Link>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((it) => {
            const active = location.pathname === it.to || location.pathname.startsWith(it.to + "/");
            return (
              <Link
                key={it.to} to={it.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  active ? "bg-brand-blue/15 text-brand-blue" : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
                }`}
              >
                <it.icon className="w-4 h-4" /> {it.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border">
          <div className="px-3 py-2 mb-1 text-xs text-muted-foreground truncate">{user.email}</div>
          <button
            onClick={async () => { await signOut(); navigate({ to: "/" }); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 md:ml-60 min-h-screen pt-14 md:pt-0">
        <Outlet />
      </main>
    </div>
  );
}
