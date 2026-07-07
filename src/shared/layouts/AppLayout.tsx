import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Truck, LayoutDashboard, FileText, ClipboardList, Gauge, MessageSquare,
  Search, LogOut, Menu, X, ChevronRight, User, Users
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logDevInteraction } from "@/shared/monitoring/devLogger";

const baseAdminLinks = [
  { to: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/admin/search", icon: Search, label: "Buscar Patente" },
  { to: "/admin/vehicles", icon: Truck, label: "Vehículos" },
  { to: "/admin/requests", icon: ClipboardList, label: "Solicitudes" },
  { to: "/admin/messages", icon: MessageSquare, label: "Mensajes" },
];

const conductorLinks = [
  { to: "/conductor", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/conductor/vehicles", icon: Truck, label: "Mis Vehículos" },
  { to: "/conductor/documents", icon: FileText, label: "Documentos" },
  { to: "/conductor/requests", icon: ClipboardList, label: "Solicitudes" },
  { to: "/conductor/mileage", icon: Gauge, label: "Kilometraje" },
  { to: "/conductor/messages", icon: MessageSquare, label: "Mensajes" },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { profile, signOut, isAdmin, isSuperAdmin } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const adminLinks = isSuperAdmin
    ? [...baseAdminLinks, { to: "/admin/users", icon: Users, label: "Usuarios" }]
    : baseAdminLinks;
  const links = isAdmin ? adminLinks : conductorLinks;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar con branding Transportes Santa Aurora */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-300 lg:relative lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary shadow-lg shadow-sidebar-primary/20">
            <Truck className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-heading text-sm font-bold text-sidebar-primary-foreground leading-tight block">FlotaControl</span>
            <span className="text-[10px] text-sidebar-foreground/50 leading-tight block">Transportes Santa Aurora</span>
          </div>
          <button className="lg:hidden text-sidebar-foreground/60 hover:text-sidebar-foreground" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
            {isAdmin ? "Administración" : "Mi Panel"}
          </p>
          {links.map(({ to, icon: Icon, label }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                onClick={() => {
                  logDevInteraction("navigation.menu.click", {
                    from: location.pathname,
                    to,
                    role: profile?.role ?? "unknown",
                  });
                  setSidebarOpen(false);
                }}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                  active
                    ? "bg-sidebar-primary/10 text-sidebar-primary shadow-sm"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{label}</span>
                {active && <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-60" />}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3 space-y-2">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-accent-foreground">
              <User className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{profile?.full_name || "Usuario"}</p>
              <p className="text-[11px] text-sidebar-foreground/50 capitalize">
                {profile?.role === "super_admin"
                  ? "Super Admin"
                  : profile?.role === "admin"
                    ? "Administrador"
                    : "Conductor"}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={async () => {
              logDevInteraction("auth.logout.click", { role: profile?.role ?? "unknown" });
              await signOut();
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar sesión
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-card/80 backdrop-blur-md px-4 lg:px-6">
          <button className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5 text-muted-foreground" />
          </button>
          <h1 className="font-heading text-base font-semibold">
            {links.find((l) => l.to === location.pathname)?.label || "FlotaControl"}
          </h1>
        </header>
        <div className="page-container animate-fade-in">{children}</div>
      </main>
    </div>
  );
}
