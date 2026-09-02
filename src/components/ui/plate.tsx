import { cn } from "@/lib/utils";

interface PlateProps {
  licensePlate?: string | null;
  className?: string;
}

const PLATE_FALLBACK = "SIN PATENTE";

/**
 * La patente es la identidad de cada vehículo de la flota.
 * Se renderiza como una placa real: blanco en claro, gris antracita en oscuro.
 */
export function Plate({ licensePlate, className }: PlateProps) {
  const plate = (licensePlate ?? "").trim().toUpperCase() || PLATE_FALLBACK;

  return (
    <span
      aria-label={`Patente ${plate}`}
      className={cn(
        "relative inline-flex items-center rounded-[5px] border border-foreground/20 bg-white px-2 py-0.5 font-data text-[13px] font-normal uppercase leading-none tracking-[0.12em] text-foreground shadow-[0_1px_2px_rgba(20,26,41,0.18)] dark:border-foreground/15 dark:bg-secondary dark:shadow-none",
        className,
      )}
    >
      <span className="mr-1.5 inline-block h-1 w-1 rounded-full bg-foreground/25" aria-hidden="true" />
      {plate}
      <span className="ml-1.5 inline-block h-1 w-1 rounded-full bg-foreground/25" aria-hidden="true" />
    </span>
  );
}