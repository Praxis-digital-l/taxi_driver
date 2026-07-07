import { normalizeRequestTypeName } from "@/lib/requestPriority";

type FuelRequestLike = {
  amount?: number | null;
  created_at?: string | null;
  request_types?: {
    name?: string | null;
  } | null;
};

export type MonthlyFuelConsumption = {
  monthKey: string;
  monthLabel: string;
  monthLongLabel: string;
  amount: number;
};

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function getMonthlyFuelRange(months = 6, now = new Date()) {
  const end = new Date(now.getFullYear(), now.getMonth(), 1);

  return Array.from({ length: months }, (_, index) => {
    const date = new Date(end.getFullYear(), end.getMonth() - (months - index - 1), 1);
    return {
      monthKey: getMonthKey(date),
      monthLabel: new Intl.DateTimeFormat("es-CL", { month: "short" }).format(date).replace(".", ""),
      monthLongLabel: new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric" }).format(date),
      amount: 0,
    };
  });
}

export function buildMonthlyFuelConsumption(requests: FuelRequestLike[], months = 6, now = new Date()) {
  const monthlyRange = getMonthlyFuelRange(months, now);
  const monthlyTotals = new Map(monthlyRange.map((item) => [item.monthKey, item.amount]));

  for (const request of requests) {
    if (normalizeRequestTypeName(request.request_types?.name) !== "combustible") {
      continue;
    }

    const createdAt = request.created_at ? new Date(request.created_at) : null;
    const amount = Number(request.amount ?? 0);

    if (!createdAt || Number.isNaN(createdAt.getTime()) || !amount || amount <= 0) {
      continue;
    }

    const monthKey = getMonthKey(createdAt);

    if (!monthlyTotals.has(monthKey)) {
      continue;
    }

    monthlyTotals.set(monthKey, (monthlyTotals.get(monthKey) ?? 0) + amount);
  }

  return monthlyRange.map((item) => ({
    ...item,
    amount: Math.round(monthlyTotals.get(item.monthKey) ?? 0),
  }));
}

