import { cn } from "@/lib/utils";

/** Mapa de estados a labels legibles */
const STATUS_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  en_proceso: "En proceso",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
  completado: "Completado",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

/** Badge reutilizable para estados de solicitudes, documentos y mensajes */
export default function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span className={cn("status-badge", `status-${status}`, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", {
        "bg-warning": status === "pendiente",
        "bg-info": status === "en_proceso",
        "bg-accent": status === "aprobado" || status === "completado",
        "bg-destructive": status === "rechazado",
      })} />
      {STATUS_LABELS[status] || status}
    </span>
  );
}

/** Todos los estados posibles de solicitud */
export const REQUEST_STATUSES = ["pendiente", "en_proceso", "aprobado", "rechazado", "completado"] as const;

/** Todos los estados posibles de documento */
export const DOC_STATUSES = ["pendiente", "aprobado", "rechazado"] as const;

/** Todos los estados posibles de mensaje */
export const MESSAGE_STATUSES = ["pendiente", "en_proceso", "completado"] as const;
