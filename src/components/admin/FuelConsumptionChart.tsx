import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { MonthlyFuelConsumption } from "@/lib/fuelConsumption";

const chartConfig = {
  amount: {
    label: "Consumo combustible",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

const currencyFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const compactFormatter = new Intl.NumberFormat("es-CL", {
  notation: "compact",
  maximumFractionDigits: 1,
});

interface FuelConsumptionChartProps {
  data: MonthlyFuelConsumption[];
}

export default function FuelConsumptionChart({ data }: FuelConsumptionChartProps) {
  const totalConsumption = data.reduce((sum, item) => sum + item.amount, 0);
  const peakMonth = data.reduce<MonthlyFuelConsumption | null>(
    (highest, item) => (!highest || item.amount > highest.amount ? item : highest),
    null,
  );

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-col gap-2 pb-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="font-heading text-base">Relacion mes vs consumo de combustible</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Montos registrados en solicitudes de tipo Combustible durante los ultimos {data.length} meses.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs">
            <span className="font-semibold text-foreground">{currencyFormatter.format(totalConsumption)}</span>
            <span className="ml-1 text-muted-foreground">acumulado</span>
          </div>
          {peakMonth && (
            <div className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs">
              <span className="font-semibold text-foreground">{peakMonth.monthLongLabel}</span>
              <span className="ml-1 text-muted-foreground">{currencyFormatter.format(peakMonth.amount)}</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {data.every((item) => item.amount === 0) ? (
          <div className="flex h-[320px] items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
            No hay consumo de combustible registrado en este periodo.
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[320px] w-full">
            <BarChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="monthLabel"
                axisLine={false}
                tickLine={false}
                tickMargin={8}
                height={36}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tickMargin={8}
                tickFormatter={(value: number) => compactFormatter.format(value)}
                width={72}
              />
              <ChartTooltip
                cursor={{ fill: "hsl(var(--muted) / 0.25)" }}
                content={
                  <ChartTooltipContent
                    indicator="dot"
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.monthLongLabel ?? ""}
                    formatter={(value) => (
                      <div className="flex min-w-[11rem] items-center justify-between gap-3">
                        <span className="text-muted-foreground">Consumo</span>
                        <span className="font-mono font-medium tabular-nums text-foreground">
                          {currencyFormatter.format(Number(value))}
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <Bar dataKey="amount" radius={[10, 10, 0, 0]}>
                {data.map((item, index) => (
                  <Cell
                    key={item.monthKey}
                    fill={index === data.length - 1 ? "hsl(var(--accent))" : "var(--color-amount)"}
                    fillOpacity={index === data.length - 1 ? 0.95 : 0.8}
                  />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

