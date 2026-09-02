import { cn } from "@/lib/utils";

type TaxiTone = "day" | "night";

interface TaxiMarkProps {
  tone?: TaxiTone;
  className?: string;
}

const TONES = {
  day: {
    body: "#FFB20F",
    roof: "#E88E05",
    glass: "#20355C",
    sign: "#FFC93C",
    signSlot: "#141A29",
    bumper: "#141A29",
    headlight: "#FFF3D6",
    wheel: "#141A29",
    hub: "#4A5468",
    checkerA: "#141A29",
    checkerB: "#FFC93C",
  },
  night: {
    body: "#1B232F",
    roof: "#11161F",
    glass: "#3A4A63",
    sign: "#F8A11E",
    signSlot: "#141A29",
    bumper: "#2A3342",
    headlight: "#FFF3D6",
    wheel: "#0A0D13",
    hub: "#2A3342",
    checkerA: "#F8A11E",
    checkerB: "#0A0D13",
  },
} as const;

/** Logo de la marca: un taxi con los colores clásicos (carrocería + banda a cuadros + letrero de techo). */
export function TaxiMark({ tone = "day", className }: TaxiMarkProps) {
  const c = TONES[tone];

  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      {/* Letrero de techo */}
      <rect x="11.5" y="0.8" width="9" height="3.4" rx="1" fill={c.sign} />
      <rect x="14" y="1.6" width="4" height="1.8" rx="0.5" fill={c.signSlot} opacity="0.9" />

      {/* Techo */}
      <rect x="9.5" y="3.6" width="13" height="4.6" rx="2" fill={c.roof} />

      {/* Parabrisas */}
      <rect x="6.5" y="5.6" width="19" height="5.6" rx="2.8" fill={c.glass} />

      {/* Carrocería */}
      <rect x="2.5" y="9.2" width="27" height="11.8" rx="3.8" fill={c.body} />

      {/* Faros */}
      <rect x="4.2" y="11.2" width="2.6" height="1.7" rx="0.85" fill={c.headlight} />
      <rect x="25.2" y="11.2" width="2.6" height="1.7" rx="0.85" fill={c.headlight} />

      {/* Banda a cuadros */}
      <rect x="4" y="15.4" width="6" height="3.4" rx="0.7" fill={c.checkerA} />
      <rect x="10" y="15.4" width="6" height="3.4" rx="0.7" fill={c.checkerB} />
      <rect x="16" y="15.4" width="6" height="3.4" rx="0.7" fill={c.checkerA} />
      <rect x="22" y="15.4" width="6" height="3.4" rx="0.7" fill={c.checkerB} />

      {/* Parachoques */}
      <rect x="5" y="20" width="22" height="1.5" rx="0.75" fill={c.bumper} />

      {/* Ruedas */}
      <circle cx="8.2" cy="22" r="3" fill={c.wheel} />
      <circle cx="23.8" cy="22" r="3" fill={c.wheel} />
      <circle cx="8.2" cy="22" r="1" fill={c.hub} />
      <circle cx="23.8" cy="22" r="1" fill={c.hub} />
    </svg>
  );
}