import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/features/auth/context/AuthContext";
import { Landmark, TrendingUp, CreditCard, Wallet, Info } from "lucide-react";

type BancoField = "lineaCredito" | "tarjetaCredito" | "saldoDisponible";

type BancoValues = Record<BancoField, string>;

const EMPTY_VALUES: BancoValues = { lineaCredito: "", tarjetaCredito: "", saldoDisponible: "" };

const FIELDS: {
  key: BancoField;
  label: string;
  hint: string;
  icon: typeof Landmark;
}[] = [
  { key: "lineaCredito", label: "Línea de crédito", hint: "Monto total de la línea de crédito", icon: TrendingUp },
  { key: "tarjetaCredito", label: "Tarjeta de crédito", hint: "Disponible en tarjeta de crédito", icon: CreditCard },
  { key: "saldoDisponible", label: "Saldo disponible", hint: "Liquidez disponible en la cuenta", icon: Wallet },
];

const formatClp = (digits: string) => {
  if (!digits) return "0";
  return new Intl.NumberFormat("es-CL").format(Number(digits));
};

const currency = (digits: string) => `$ ${formatClp(digits)}`;

export default function AdminBanco() {
  const { profile } = useAuth();
  const storageKey = profile ? `banco:saldos:${profile.id}` : null;
  const [values, setValues] = useState<BancoValues>(EMPTY_VALUES);
  const hydrated = useRef(false);

  useEffect(() => {
    if (!storageKey || hydrated.current) return;
    hydrated.current = true;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setValues((prev) => ({ ...prev, ...JSON.parse(raw) }));
    } catch {
      /* datos locales dañados: se ignoran */
    }
  }, [storageKey]);

  const handleChange = (field: BancoField, raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 12);
    const next = { ...values, [field]: digits };
    setValues(next);
    if (storageKey) localStorage.setItem(storageKey, JSON.stringify(next));
  };

  const linea = Number(values.lineaCredito || 0);
  const tarjeta = Number(values.tarjetaCredito || 0);
  const saldo = Number(values.saldoDisponible || 0);
  const usado = saldo + tarjeta;
  const porcentaje = linea > 0 ? Math.min(100, Math.round((usado / linea) * 100)) : 0;

  const readouts = [
    { label: "Línea de crédito", value: currency(values.lineaCredito) },
    { label: "Tarjeta de crédito", value: currency(values.tarjetaCredito) },
    { label: "Saldo disponible", value: currency(values.saldoDisponible) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Banco"
        description="Montos bancarios de la operación, actualizados por ti cada día."
      />

      {/* Tablero del día: lectura de los tres montos */}
      <section className="relative overflow-hidden rounded-xl bg-board text-board-foreground shadow-md">
        <span className="absolute inset-y-0 left-0 w-1 bg-board-primary" aria-hidden="true" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-board-primary/15 blur-3xl"
        />

        <div className="relative p-6">
          <p className="font-data text-[9px] uppercase tracking-[0.3em] text-board-primary">
            Estado bancario del turno
          </p>
          <h3 className="mt-1.5 font-heading text-xl font-semibold tracking-wide text-board-accent-foreground">
            Liquidez de la operación
          </h3>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {readouts.map(({ label, value }) => (
              <div key={label} className="rounded-md border border-board-border bg-board-accent/70 px-4 py-3">
                <p className="font-data text-2xl font-medium leading-none tabular-nums text-board-primary">
                  {value}
                </p>
                <p className="mt-2 text-[13px] font-medium text-board-accent-foreground/90">{label}</p>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between text-xs">
              <span className="font-data uppercase tracking-[0.2em] text-board-foreground/60">
                Uso: {currency(String(usado))} de {currency(String(linea))}
              </span>
              <span className="font-data text-board-primary">{porcentaje}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-board-accent" role="presentation">
              <div
                className="h-full rounded-full bg-board-primary shadow-[0_0_8px_rgba(248,161,30,0.6)] transition-[width] duration-300"
                style={{ width: `${porcentaje}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Edición de montos */}
      <Card className="overflow-hidden">
        <span className="block h-1 w-full bg-primary" aria-hidden="true" />
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-heading text-base">
            <Landmark className="h-4 w-4 text-primary" />
            Digitar montos
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Escribe los montos de hoy y quedan guardados al instante en este equipo.
          </p>
        </CardHeader>

        <CardContent>
          <div className="grid gap-6 sm:grid-cols-3">
            {FIELDS.map(({ key, label, hint, icon: Icon }) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={`banco-${key}`} className="flex items-center gap-2 text-sm font-medium">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {label}
                </Label>
                <p className="text-xs text-muted-foreground">{hint}</p>
                <div className="relative">
                  <span
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-data text-sm text-muted-foreground"
                    aria-hidden="true"
                  >
                    $
                  </span>
                  <Input
                    id={`banco-${key}`}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="0"
                    value={formatClp(values[key])}
                    onChange={(event) => handleChange(key, event.target.value)}
                    className="h-12 pl-7 pr-3 font-data text-lg tracking-tight placeholder:text-muted-foreground/70"
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="mt-6 flex items-center gap-1.5 border-t pt-4 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0" />
            Los montos se guardan solo en este navegador, no en la base de datos.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}