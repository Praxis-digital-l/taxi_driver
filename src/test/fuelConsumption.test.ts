import { describe, expect, it } from "vitest";
import { buildMonthlyFuelConsumption } from "@/lib/fuelConsumption";

describe("fuel consumption helpers", () => {
  it("groups combustible requests by month and ignores other request types", () => {
    const data = buildMonthlyFuelConsumption(
      [
        { created_at: "2026-01-10T10:00:00Z", amount: 100000, request_types: { name: "Combustible" } },
        { created_at: "2026-01-20T10:00:00Z", amount: 50000, request_types: { name: "Combustible" } },
        { created_at: "2026-02-08T10:00:00Z", amount: 80000, request_types: { name: "Mantencion" } },
        { created_at: "2026-03-02T10:00:00Z", amount: 75000, request_types: { name: "Combustible" } },
      ],
      3,
      new Date("2026-03-15T12:00:00Z"),
    );

    expect(data.map((item) => item.amount)).toEqual([150000, 0, 75000]);
  });

  it("returns empty months with zero amount when there is no data", () => {
    const data = buildMonthlyFuelConsumption([], 2, new Date("2026-04-01T00:00:00Z"));

    expect(data.map((item) => item.amount)).toEqual([0, 0]);
  });
});
