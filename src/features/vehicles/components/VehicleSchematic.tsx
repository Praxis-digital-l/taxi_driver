import React from "react";
import type { PartCondition } from "../types/vehicleInspection";

interface VehicleSchematicProps {
  partStatusMap: Record<string, PartCondition>;
  selectedPartKey: string | null;
  onSelectPart: (partKey: string) => void;
  className?: string;
}

export default function VehicleSchematic({
  partStatusMap,
  selectedPartKey,
  onSelectPart,
  className = "",
}: VehicleSchematicProps) {
  const getPartStyles = (partKey: string) => {
    const condition = partStatusMap[partKey] || "good";
    const isSelected = selectedPartKey === partKey;

    let fill = "rgba(30, 41, 59, 0.4)";
    let stroke = "#475569";
    let filter = "none";

    if (condition === "damaged") {
      fill = "rgba(239, 68, 68, 0.65)";
      stroke = "#ef4444";
      filter = isSelected ? "drop-shadow(0 0 8px rgba(239, 68, 68, 0.9))" : "none";
    } else if (condition === "warning") {
      fill = "rgba(245, 158, 11, 0.55)";
      stroke = "#f59e0b";
      filter = isSelected ? "drop-shadow(0 0 8px rgba(245, 158, 11, 0.9))" : "none";
    } else {
      fill = "rgba(16, 185, 129, 0.15)";
      stroke = "#10b981";
      filter = isSelected ? "drop-shadow(0 0 8px rgba(16, 185, 129, 0.9))" : "none";
    }

    const strokeWidth = isSelected ? "2.5" : "1.5";
    if (isSelected) {
      stroke = "#38bdf8";
    }

    return { fill, stroke, strokeWidth, filter };
  };

  return (
    <div className={`relative flex flex-col items-center justify-center p-2 rounded-xl bg-slate-950/90 border border-slate-800 text-slate-100 shadow-inner select-none ${className}`}>
      {/* Schematic Header Bar */}
      <div className="w-full flex items-center justify-between pb-2 border-b border-slate-800/80 mb-2 px-2 text-[11px] font-mono text-slate-400">
        <span className="flex items-center gap-1.5 font-semibold text-slate-200">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          DIAGRAMA MECÁNICO
        </span>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-emerald-500" /> Óptimo
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-amber-500" /> Observación
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-rose-500" /> Dañado
          </span>
        </div>
      </div>

      <div className="w-full max-w-[420px] aspect-[14/19] relative">
        <svg
          viewBox="0 0 420 570"
          className="w-full h-full drop-shadow-md overflow-visible"
        >
          <defs>
            <pattern id="blueprint-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(51, 65, 85, 0.25)" strokeWidth="0.5" />
            </pattern>
          </defs>

          {/* Background grid */}
          <rect width="420" height="570" fill="url(#blueprint-grid)" rx="8" />

          {/* Lines */}
          <g stroke="#334155" strokeWidth="1" strokeDasharray="3 3">
            <path d="M 75 40 L 155 40 L 175 100" fill="none" />
            <path d="M 345 40 L 265 40 L 245 100" fill="none" />
            <path d="M 50 170 L 105 170" fill="none" />
            <path d="M 370 170 L 315 170" fill="none" />
            <path d="M 50 410 L 105 410" fill="none" />
            <path d="M 370 410 L 315 410" fill="none" />
            <path d="M 75 520 L 155 520 L 175 460" fill="none" />
            <path d="M 345 520 L 265 520 L 245 480" fill="none" />
          </g>

          {/* Batería */}
          <g className="cursor-pointer transition-transform hover:scale-105" onClick={() => onSelectPart("battery")}>
            <rect x="20" y="20" width="65" height="40" rx="4" {...getPartStyles("battery")} />
            <rect x="30" y="16" width="10" height="4" fill="#94a3b8" />
            <rect x="65" y="16" width="10" height="4" fill="#94a3b8" />
            <text x="52" y="44" textAnchor="middle" fontSize="10" fill="#f8fafc" fontWeight="bold">
              BATERÍA
            </text>
          </g>

          {/* Motor */}
          <g className="cursor-pointer transition-transform hover:scale-105" onClick={() => onSelectPart("engine")}>
            <rect x="335" y="20" width="65" height="40" rx="4" {...getPartStyles("engine")} />
            <text x="367" y="44" textAnchor="middle" fontSize="10" fill="#f8fafc" fontWeight="bold">
              MOTOR
            </text>
          </g>

          {/* Estanque */}
          <g className="cursor-pointer transition-transform hover:scale-105" onClick={() => onSelectPart("gas_tank")}>
            <rect x="20" y="500" width="65" height="40" rx="4" {...getPartStyles("gas_tank")} />
            <text x="52" y="524" textAnchor="middle" fontSize="9" fill="#f8fafc" fontWeight="bold">
              ESTANQUE
            </text>
          </g>

          {/* Escape */}
          <g className="cursor-pointer transition-transform hover:scale-105" onClick={() => onSelectPart("muffler")}>
            <rect x="335" y="500" width="65" height="40" rx="4" {...getPartStyles("muffler")} />
            <text x="367" y="524" textAnchor="middle" fontSize="9" fill="#f8fafc" fontWeight="bold">
              ESCAPE
            </text>
          </g>

          {/* Neumático DI */}
          <g className="cursor-pointer transition-opacity hover:opacity-85" onClick={() => onSelectPart("front_left_tire")}>
            <rect x="92" y="135" width="26" height="70" rx="5" {...getPartStyles("front_left_tire")} />
            <line x1="92" y1="150" x2="118" y2="150" stroke="#0f172a" strokeWidth="1.5" />
            <line x1="92" y1="170" x2="118" y2="170" stroke="#0f172a" strokeWidth="1.5" />
            <line x1="92" y1="190" x2="118" y2="190" stroke="#0f172a" strokeWidth="1.5" />
          </g>

          {/* Neumático DD */}
          <g className="cursor-pointer transition-opacity hover:opacity-85" onClick={() => onSelectPart("front_right_tire")}>
            <rect x="302" y="135" width="26" height="70" rx="5" {...getPartStyles("front_right_tire")} />
            <line x1="302" y1="150" x2="328" y2="150" stroke="#0f172a" strokeWidth="1.5" />
            <line x1="302" y1="170" x2="328" y2="170" stroke="#0f172a" strokeWidth="1.5" />
            <line x1="302" y1="190" x2="328" y2="190" stroke="#0f172a" strokeWidth="1.5" />
          </g>

          {/* Neumático TI */}
          <g className="cursor-pointer transition-opacity hover:opacity-85" onClick={() => onSelectPart("rear_left_tire")}>
            <rect x="92" y="375" width="26" height="70" rx="5" {...getPartStyles("rear_left_tire")} />
            <line x1="92" y1="390" x2="118" y2="390" stroke="#0f172a" strokeWidth="1.5" />
            <line x1="92" y1="410" x2="118" y2="410" stroke="#0f172a" strokeWidth="1.5" />
            <line x1="92" y1="430" x2="118" y2="430" stroke="#0f172a" strokeWidth="1.5" />
          </g>

          {/* Neumático TD */}
          <g className="cursor-pointer transition-opacity hover:opacity-85" onClick={() => onSelectPart("rear_right_tire")}>
            <rect x="302" y="375" width="26" height="70" rx="5" {...getPartStyles("rear_right_tire")} />
            <line x1="302" y1="390" x2="328" y2="390" stroke="#0f172a" strokeWidth="1.5" />
            <line x1="302" y1="410" x2="328" y2="410" stroke="#0f172a" strokeWidth="1.5" />
            <line x1="302" y1="430" x2="328" y2="430" stroke="#0f172a" strokeWidth="1.5" />
          </g>

          {/* Parachoques Delantero */}
          <g className="cursor-pointer transition-opacity hover:opacity-85" onClick={() => onSelectPart("front_bumper")}>
            <path d="M 130 85 C 170 70, 250 70, 290 85 L 290 98 L 130 98 Z" {...getPartStyles("front_bumper")} />
          </g>

          {/* Foco Izquierdo */}
          <g className="cursor-pointer transition-opacity hover:opacity-85" onClick={() => onSelectPart("left_headlight")}>
            <polygon points="132,95 155,95 150,108 132,108" {...getPartStyles("left_headlight")} />
          </g>

          {/* Foco Derecho */}
          <g className="cursor-pointer transition-opacity hover:opacity-85" onClick={() => onSelectPart("right_headlight")}>
            <polygon points="265,95 288,95 288,108 270,108" {...getPartStyles("right_headlight")} />
          </g>

          {/* Capó */}
          <g className="cursor-pointer transition-opacity hover:opacity-85" onClick={() => onSelectPart("hood")}>
            <path d="M 130 100 L 290 100 L 285 195 L 135 195 Z" {...getPartStyles("hood")} />
            <line x1="165" y1="105" x2="175" y2="188" stroke="#334155" strokeWidth="1" />
            <line x1="255" y1="105" x2="245" y2="188" stroke="#334155" strokeWidth="1" />
            <text x="210" y="153" textAnchor="middle" fontSize="12" fill="#94a3b8" fontWeight="bold">
              CAPÓ
            </text>
          </g>

          {/* Parabrisas */}
          <g className="cursor-pointer transition-opacity hover:opacity-85" onClick={() => onSelectPart("windshield")}>
            <path d="M 136 198 L 284 198 L 275 250 L 145 250 Z" {...getPartStyles("windshield")} />
            <text x="210" y="228" textAnchor="middle" fontSize="11" fill="#cbd5e1" fontWeight="bold">
              PARABRISAS
            </text>
          </g>

          {/* Puerta Delantera Izquierda */}
          <g className="cursor-pointer transition-opacity hover:opacity-85" onClick={() => onSelectPart("front_left_door")}>
            <path d="M 120 200 L 143 252 L 143 310 L 120 310 Z" {...getPartStyles("front_left_door")} />
            <rect x="122" y="285" width="4" height="15" rx="1" fill="#64748b" />
          </g>

          {/* Puerta Delantera Derecha */}
          <g className="cursor-pointer transition-opacity hover:opacity-85" onClick={() => onSelectPart("front_right_door")}>
            <path d="M 300 200 L 277 252 L 277 310 L 300 310 Z" {...getPartStyles("front_right_door")} />
            <rect x="294" y="285" width="4" height="15" rx="1" fill="#64748b" />
          </g>

          {/* Techo */}
          <g className="cursor-pointer transition-opacity hover:opacity-85" onClick={() => onSelectPart("roof")}>
            <rect x="145" y="253" width="130" height="125" rx="4" {...getPartStyles("roof")} />
            <rect x="165" y="268" width="90" height="40" rx="3" fill="none" stroke="#334155" strokeWidth="1" strokeDasharray="2 2" />
            <text x="210" y="325" textAnchor="middle" fontSize="12" fill="#94a3b8" fontWeight="bold">
              TECHO
            </text>
          </g>

          {/* Puerta Trasera Izquierda */}
          <g className="cursor-pointer transition-opacity hover:opacity-85" onClick={() => onSelectPart("rear_left_door")}>
            <path d="M 120 313 L 143 313 L 143 380 L 120 380 Z" {...getPartStyles("rear_left_door")} />
            <rect x="122" y="325" width="4" height="15" rx="1" fill="#64748b" />
          </g>

          {/* Puerta Trasera Derecha */}
          <g className="cursor-pointer transition-opacity hover:opacity-85" onClick={() => onSelectPart("rear_right_door")}>
            <path d="M 300 313 L 277 313 L 277 380 L 300 380 Z" {...getPartStyles("rear_right_door")} />
            <rect x="294" y="325" width="4" height="15" rx="1" fill="#64748b" />
          </g>

          {/* Luneta Trasera */}
          <g className="cursor-pointer transition-opacity hover:opacity-85" onClick={() => onSelectPart("rear_windshield")}>
            <path d="M 145 380 L 275 380 L 282 422 L 138 422 Z" {...getPartStyles("rear_windshield")} />
            <text x="210" y="405" textAnchor="middle" fontSize="10" fill="#cbd5e1" fontWeight="bold">
              LUNETA TRASERA
            </text>
          </g>

          {/* Maletero */}
          <g className="cursor-pointer transition-opacity hover:opacity-85" onClick={() => onSelectPart("trunk")} cursor="pointer">
            <path d="M 136 425 L 284 425 L 285 480 L 135 480 Z" {...getPartStyles("trunk")} />
            <text x="210" y="457" textAnchor="middle" fontSize="12" fill="#94a3b8" fontWeight="bold">
              MALETERO
            </text>
          </g>

          {/* Luces Traseras */}
          <g className="cursor-pointer transition-opacity hover:opacity-85" onClick={() => onSelectPart("left_taillight")}>
            <rect x="133" y="475" width="22" height="12" rx="2" {...getPartStyles("left_taillight")} />
          </g>
          <g className="cursor-pointer transition-opacity hover:opacity-85" onClick={() => onSelectPart("right_taillight")}>
            <rect x="265" y="475" width="22" height="12" rx="2" {...getPartStyles("right_taillight")} />
          </g>

          {/* Parachoques Trasero */}
          <g className="cursor-pointer transition-opacity hover:opacity-85" onClick={() => onSelectPart("rear_bumper")}>
            <path d="M 130 482 L 290 482 L 288 498 C 248 506, 172 506, 132 498 Z" {...getPartStyles("rear_bumper")} />
          </g>

          {/* Espejos Laterales */}
          <g className="cursor-pointer transition-opacity hover:opacity-85" onClick={() => onSelectPart("mirrors")}>
            <path d="M 118 200 L 105 192 L 105 208 L 118 205 Z" {...getPartStyles("mirrors")} />
            <path d="M 302 200 L 315 192 L 315 208 L 302 205 Z" {...getPartStyles("mirrors")} />
          </g>
        </svg>
      </div>

      <div className="w-full text-center text-[10px] text-slate-400 mt-2 font-mono">
        💡 Haz clic en cualquier parte del vehículo para inspeccionarla o registrar una observación
      </div>
    </div>
  );
}

