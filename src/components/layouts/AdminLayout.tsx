import type { ReactNode } from "react";
import { ClipboardList, LayoutDashboard, MessageSquare, Search, Truck } from "lucide-react";
import AppShell from "@/components/layouts/AppShell";

const adminLinks = [
  { to: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/admin/search", icon: Search, label: "Buscar por patente" },
  { to: "/admin/vehicles", icon: Truck, label: "Gestion de flota" },
  { to: "/admin/requests", icon: ClipboardList, label: "Solicitudes" },
  { to: "/admin/messages", icon: MessageSquare, label: "Mensajes" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell
      role="admin"
      navLinks={adminLinks}
      shellTitle="Centro de Control"
      shellSubtitle="Vista administrativa de flota"
      sectionLabel="Administracion"
      accentClassName="bg-sidebar-primary text-sidebar-primary-foreground shadow-sidebar-primary/20"
    >
      {children}
    </AppShell>
  );
}
