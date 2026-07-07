import type { ReactNode } from "react";
import { ClipboardList, FileText, Gauge, LayoutDashboard, MessageSquare, Truck } from "lucide-react";
import AppShell from "@/components/layouts/AppShell";

const conductorLinks = [
  { to: "/conductor", icon: LayoutDashboard, label: "Mi panel" },
  { to: "/conductor/vehicles", icon: Truck, label: "Mis vehiculos" },
  { to: "/conductor/documents", icon: FileText, label: "Documentos" },
  { to: "/conductor/requests", icon: ClipboardList, label: "Solicitudes" },
  { to: "/conductor/mileage", icon: Gauge, label: "Kilometraje" },
  { to: "/conductor/messages", icon: MessageSquare, label: "Mensajes" },
];

export default function ConductorLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell
      role="conductor"
      navLinks={conductorLinks}
      shellTitle="Portal del Conductor"
      shellSubtitle="Vista personal y operativa"
      sectionLabel="Panel personal"
      accentClassName="bg-accent text-accent-foreground shadow-accent/10"
    >
      {children}
    </AppShell>
  );
}
