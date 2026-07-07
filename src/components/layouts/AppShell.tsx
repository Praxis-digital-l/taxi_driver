import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { ChevronRight, LogOut, Menu, Shield, Truck, User, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import AccessDeniedNotice from "@/components/AccessDeniedNotice";
import { Button } from "@/components/ui/button";
import { ROLE_LABEL, type AppRole } from "@/lib/authz";
import { cn } from "@/lib/utils";

type NavLinkItem = {
  to: string;
  icon: LucideIcon;
  label: string;
};

type AppShellProps = {
  children: ReactNode;
  role: AppRole;
  navLinks: NavLinkItem[];
  shellTitle: string;
  shellSubtitle: string;
  sectionLabel: string;
  accentClassName: string;
};

export default function AppShell({
  children,
  role,
  navLinks,
  shellTitle,
  shellSubtitle,
  sectionLabel,
  accentClassName,
}: AppShellProps) {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r bg-sidebar text-sidebar-foreground transition-transform duration-300 lg:relative lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex min-h-20 items-center gap-3 border-b border-sidebar-border px-5">
          <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl shadow-lg", accentClassName)}>
            {role === "admin" ? <Shield className="h-5 w-5" /> : <Truck className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <span className="block font-heading text-sm font-bold leading-tight">{shellTitle}</span>
            <span className="block text-[11px] text-sidebar-foreground/60">{shellSubtitle}</span>
          </div>
          <button
            type="button"
            className="text-sidebar-foreground/60 hover:text-sidebar-foreground lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-sidebar-foreground/40">
            {sectionLabel}
          </p>
          {navLinks.map(({ to, icon: Icon, label }) => {
            const active = location.pathname === to;

            return (
              <Link
                key={to}
                to={to}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-150",
                  active
                    ? "bg-sidebar-primary/10 text-sidebar-primary shadow-sm"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{label}</span>
                {active && <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-60" />}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-3 border-t border-sidebar-border p-3">
          <div className="rounded-xl border border-sidebar-border/60 bg-sidebar-accent/40 px-3 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-accent-foreground">
                <User className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{profile?.full_name || "Usuario"}</p>
                <p className="truncate text-[11px] text-sidebar-foreground/60">{profile?.email || "Sin correo"}</p>
              </div>
            </div>
            <div className="mt-3 inline-flex rounded-full bg-sidebar-primary/10 px-2.5 py-1 text-[11px] font-semibold text-sidebar-primary">
              {ROLE_LABEL[role]}
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            onClick={signOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar sesion
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-card/80 px-4 backdrop-blur-md lg:px-6">
          <button type="button" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5 text-muted-foreground" />
          </button>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{shellSubtitle}</p>
            <h1 className="font-heading text-base font-semibold">
              {navLinks.find((link) => link.to === location.pathname)?.label || shellTitle}
            </h1>
          </div>
        </header>

        <div className="page-container animate-fade-in">
          <AccessDeniedNotice />
          {children}
        </div>
      </main>
    </div>
  );
}
