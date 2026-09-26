import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/context/AuthContext";
import { Button } from "@/components/ui/button";
import { ConductorAvatar } from "@/components/ConductorAvatar";
import { UserProfileDialog } from "@/components/UserProfileDialog";
import { BrandMark } from "@/components/ui/BrandMark";
import ThemeSwitch from "@/components/ThemeSwitch";
import {
  Truck, LayoutDashboard, FileText, ClipboardList, Gauge, MessageSquare,
  LogOut, Menu, X, ChevronRight, Users, Calculator, Upload, Wallet, Landmark, ArrowLeftRight, Clock, UserCog
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logDevInteraction } from "@/shared/monitoring/devLogger";

const baseAdminLinks = [
  { to: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/admin/banco", icon: Landmark, label: "Banco" },
  { to: "/admin/documents", icon: FileText, label: "Documentos" },
  { to: "/admin/conductores", icon: Users, label: "Conductores" },
  { to: "/admin/nomina", icon: Calculator, label: "Nómina" },
  { to: "/admin/vehicles", icon: Truck, label: "Vehículos" },
  { to: "/admin/requests", icon: ClipboardList, label: "Solicitudes" },
  { to: "/admin/messages", icon: MessageSquare, label: "Mensajes" },
  { to: "/admin/bulk-upload", icon: Upload, label: "Carga Masiva" },
  { to: "/admin/pendientes", icon: Clock, label: "Pendientes" },
  { to: "/admin/finanzas", icon: ArrowLeftRight, label: "Ingresos y Egresos" },
];

const conductorLinks = [
  { to: "/conductor", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/conductor/vehicles", icon: Truck, label: "Mis Vehículos" },
  { to: "/conductor/documents", icon: FileText, label: "Documentos" },
  { to: "/conductor/requests", icon: ClipboardList, label: "Solicitudes" },
  { to: "/conductor/mileage", icon: Gauge, label: "Kilometraje" },
  { to: "/conductor/liquidaciones", icon: Wallet, label: "Liquidaciones" },
  { to: "/conductor/messages", icon: MessageSquare, label: "Mensajes" },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { profile, signOut, isAdmin } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const links = isAdmin ? baseAdminLinks : conductorLinks;

  const userDisplayName =
    profile?.full_name ||
    [profile?.nombres, profile?.apellido_paterno].filter(Boolean).join(" ") ||
    "Usuario";

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar: el tablero de noche */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-300 lg:relative lg:translate-x-0 border-r border-sidebar-border",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary shadow-[0_0_16px_rgba(248,161,30,0.45)]">
            <BrandMark className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-heading text-[15px] font-bold leading-tight block text-sidebar-accent-foreground tracking-wide">
              Transportes El Montañez
            </span>
            <span className="font-data text-[9px] uppercase tracking-[0.28em] text-sidebar-foreground/55 leading-tight block">
              Control de flota
            </span>
          </div>
          <button className="lg:hidden text-sidebar-foreground/60 hover:text-sidebar-foreground" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          <p className="px-4 pt-2 pb-1 font-data text-[9px] uppercase tracking-[0.28em] text-sidebar-primary/80">
            {isAdmin ? "Administración" : "Mi panel"}
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
                  "relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
                  active
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
                )}
              >
                {active && (
                  <span
                    className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-sidebar-primary shadow-[0_0_10px_rgba(248,161,30,0.8)]"
                    aria-hidden="true"
                  />
                )}
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{label}</span>
                {active && <ChevronRight className="ml-auto h-3.5 w-3.5 text-sidebar-primary/70" />}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3 space-y-2">
          <button
            type="button"
            onClick={() => setProfileDialogOpen(true)}
            className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-sidebar-accent/70 transition-colors group"
            title="Abrir mi perfil"
          >
            <ConductorAvatar fullName={userDisplayName} photoUrl={profile?.photo_url} className="h-9 w-9 ring-2 ring-sidebar-primary/20 group-hover:ring-sidebar-primary/50 transition-all" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {userDisplayName}
              </p>
              <p className="font-data text-[9px] uppercase tracking-[0.2em] text-sidebar-foreground/50">
                {profile?.role === "super_admin" 
                  ? "Super Admin" 
                  : profile?.role === "admin" 
                    ? "Admin" 
                    : "Conductor"}
              </p>
            </div>
            <span
              className="h-2 w-2 shrink-0 rounded-full bg-sidebar-primary shadow-[0_0_8px_rgba(248,161,30,0.9)]"
              title="Turno activo"
              aria-hidden="true"
            />
          </button>
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

      {/* Main content: la luz del día */}
      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-card/80 backdrop-blur-md px-4 lg:px-6">
          <button className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5 text-muted-foreground" />
          </button>
          <span className="h-5 w-[3px] rounded-full bg-sidebar-primary" aria-hidden="true" />
          <h1 className="font-heading text-base font-semibold tracking-wide">
            {links.find((l) => l.to === location.pathname)?.label || "Control de flota"}
          </h1>
          <div className="ml-auto flex items-center gap-3">
            <ThemeSwitch />
          </div>
        </header>
        <div className="page-container animate-fade-in">{children}</div>
      </main>

      <UserProfileDialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen} />
    </div>
  );
}

