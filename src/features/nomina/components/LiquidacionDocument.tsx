import { type ResultadoNomina } from "@/lib/nomina";

export const LIQUIDACION_A4 = { width: 794, height: 1123 } as const;

const PALETA = {
  navy: "#141A29",
  navy2: "#20355C",
  amber: "#FFC93C",
  amberDark: "#E88E05",
  amberDeep: "#8A5A00",
  soft: "#F4F6FA",
  softAmber: "#FFF7E6",
  line: "#E6EAF1",
  ink: "#1F2937",
  muted: "#6B7280",
  neg: "#C0392B",
} as const;

const F = {
  heading: "'Saira Semi Condensed', sans-serif",
  body: "'Public Sans', system-ui, sans-serif",
  data: "'Fragment Mono', monospace",
} as const;

const MONEDA = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

function Fila({ concepto, monto, destacado = false }: { concepto: string; monto: number; destacado?: boolean }) {
  return (
    <div className="flex items-baseline justify-between py-1">
      <span className={destacado ? "text-[13.5px] font-semibold" : "text-[13px]"} style={{ color: PALETA.ink }}>
        {concepto}
      </span>
      <span
        className={destacado ? "text-[15px] font-bold" : "text-[13px]"}
        style={{ fontFamily: F.data, color: monto < 0 ? PALETA.neg : PALETA.ink }}
      >
        {MONEDA.format(monto)}
      </span>
    </div>
  );
}

function Campo({
  label,
  valor,
  mono = false,
  quebrar = false,
  borde = false,
}: {
  label: string;
  valor: string;
  mono?: boolean;
  quebrar?: boolean;
  borde?: boolean;
}) {
  return (
    <div
      className={`min-w-0 w-1/4 px-4 py-2.5 ${quebrar ? "break-all" : ""} ${borde ? "border-l" : ""}`}
      style={borde ? { borderColor: PALETA.line } : undefined}
    >
      <p
        className="text-[9px] uppercase leading-tight break-words tracking-[0.12em]"
        style={{ fontFamily: F.data, color: PALETA.muted }}
      >
        {label}
      </p>
      <p
        className={`mt-1 leading-snug text-[12.5px] font-semibold ${quebrar ? "break-all" : "break-words"}`}
        style={{ fontFamily: mono ? F.data : F.body, color: PALETA.ink }}
      >
        {valor || "—"}
      </p>
    </div>
  );
}

interface LiquidacionDocumentProps {
  resultado: ResultadoNomina;
  mes: string;
  fecha: string;
}

export default function LiquidacionDocument({ resultado, mes, fecha }: LiquidacionDocumentProps) {
  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{
        width: LIQUIDACION_A4.width,
        height: LIQUIDACION_A4.height,
        backgroundColor: "#ffffff",
        fontFamily: F.body,
        color: PALETA.ink,
      }}
    >
      <header className="px-12 pb-8 pt-9" style={{ backgroundColor: PALETA.navy }}>
        <div className="flex items-start justify-between gap-6">
          <div className="flex min-w-0 items-center gap-4">
            <img
              src="/flotacontrol-icon.svg"
              alt=""
              width={58}
              height={58}
              className="rounded-xl"
              style={{ boxShadow: "0 0 0 3px rgba(255,201,60,0.35)" }}
            />
            <div className="min-w-0">
              <p
                className="text-[22px] font-bold leading-tight tracking-wide text-white"
                style={{ fontFamily: F.heading }}
              >
                TRANSPORTES EL&nbsp;MONTAÑEZ
              </p>
              <p
                className="mt-1 text-[10px] font-medium uppercase tracking-[0.22em]"
                style={{ fontFamily: F.data, color: PALETA.amber }}
              >
                Liquidación de nómina
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[9px] uppercase tracking-[0.3em]" style={{ fontFamily: F.data, color: PALETA.amber }}>
              Documento oficial
            </p>
            <p className="text-[30px] font-bold capitalize leading-tight text-white" style={{ fontFamily: F.heading }}>
              {mes}
            </p>
            <p className="mt-1 text-[10px]" style={{ fontFamily: F.data, color: "rgba(255,255,255,0.72)" }}>
              Emitido el {fecha}
            </p>
          </div>
        </div>
      </header>

      <section
        className="mx-12 mt-4 flex overflow-hidden rounded-lg border"
        style={{ borderColor: PALETA.line, backgroundColor: PALETA.soft }}
      >
        <Campo label="Trabajador" valor={resultado.nombre} />
        <Campo label="ID de trabajador" valor={resultado.trabajadorId} mono borde />
        <Campo label="RUT" valor={resultado.rut} mono borde />
        <Campo label="Correo" valor={resultado.email} quebrar borde />
      </section>

      <main className="flex flex-1 flex-col gap-4 px-12 pb-2 pt-5">
        <section className="overflow-hidden rounded-xl border" style={{ borderColor: PALETA.line }}>
          <div className="flex items-center gap-2.5 px-5 py-2" style={{ backgroundColor: PALETA.softAmber }}>
            <span className="h-3.5 w-1 rounded-full" style={{ backgroundColor: PALETA.amberDark }} />
            <h2
              className="text-[12px] font-bold uppercase tracking-[0.16em]"
              style={{ fontFamily: F.heading, color: PALETA.amberDeep }}
            >
              Ingresos
            </h2>
          </div>
          <div className="px-5 py-2">
            <Fila concepto="Total facturado" monto={resultado.totalFacturado} destacado />
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border" style={{ borderColor: PALETA.line }}>
          <div className="flex items-center gap-2.5 px-5 py-2" style={{ backgroundColor: PALETA.soft }}>
            <span className="h-3.5 w-1 rounded-full" style={{ backgroundColor: PALETA.amberDark }} />
            <h2
              className="text-[12px] font-bold uppercase tracking-[0.16em]"
              style={{ fontFamily: F.heading, color: "#374151" }}
            >
              Descuentos
            </h2>
          </div>
          <div className="px-5 py-2">
            {resultado.descuentosPrimarios.map((d, i) => (
              <Fila key={`prim-${i}`} concepto={d.concepto} monto={-d.monto} />
            ))}
            {resultado.descuentosSecundarios.length > 0 && (
              <>
                <div className="my-1 border-t border-dashed" style={{ borderColor: "rgba(107,114,128,0.45)" }} />
                {resultado.descuentosSecundarios.map((d, i) => (
                  <Fila key={`sec-${i}`} concepto={d.concepto} monto={-d.monto} />
                ))}
              </>
            )}
          </div>
        </section>
      </main>

      <section className="mx-12 mt-1 mb-5 rounded-xl px-6 py-4" style={{ backgroundColor: PALETA.navy }}>
        <div className="flex items-center justify-between py-1 text-[13px]">
          <span style={{ color: "#AEB6C4" }}>Subtotal</span>
          <span className="font-medium text-white" style={{ fontFamily: F.data }}>
            {MONEDA.format(resultado.subtotal)}
          </span>
        </div>
        <div className="flex items-center justify-between py-1 text-[13px]">
          <span style={{ color: "#AEB6C4" }}>Total descuentos</span>
          <span className="font-medium" style={{ fontFamily: F.data, color: "#FF8A80" }}>
            -{MONEDA.format(resultado.totalDescuentos)}
          </span>
        </div>
        <div className="my-2 border-t border-white/15" />
        <div className="flex items-center justify-between">
          <span
            className="text-[13px] font-bold uppercase tracking-[0.16em]"
            style={{ fontFamily: F.heading, color: PALETA.amber }}
          >
            Total a pagar
          </span>
          <span className="text-[26px] font-bold text-white" style={{ fontFamily: F.data }}>
            {MONEDA.format(resultado.totalAPagar)}
          </span>
        </div>
      </section>

      <footer className="flex items-end justify-between px-12 pb-8 text-[9.5px]" style={{ color: PALETA.muted }}>
        <div className="space-y-0.5">
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#4B5563]"
            style={{ fontFamily: F.heading }}
          >
            Transportes El Montañez
          </p>
          <p>RUT 77.777.777-7 · Documento generado electrónicamente</p>
          <p>Si tiene dudas sobre esta liquidación, contacte a administración.</p>
        </div>
        <div className="text-right" style={{ fontFamily: F.data }}>
          <p>{resultado.nombre}</p>
          <p>
            {mes.charAt(0).toUpperCase() + mes.slice(1)} · {fecha}
          </p>
        </div>
      </footer>
    </div>
  );
}