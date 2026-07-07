import { describe, expect, it } from "vitest";
import {
  buildRequestPriorityBreakdown,
  getRequestPriorityInfo,
  sortRequestsByPriority,
} from "@/lib/requestPriority";

describe("request priority helpers", () => {
  it("maps known request types to the expected priorities", () => {
    expect(getRequestPriorityInfo("Combustible").key).toBe("urgent");
    expect(getRequestPriorityInfo("Repuestos").key).toBe("high");
    expect(getRequestPriorityInfo("Mantencion").key).toBe("medium_high");
    expect(getRequestPriorityInfo("Prestamo").key).toBe("low");
    expect(getRequestPriorityInfo("Anticipo").key).toBe("very_low");
  });

  it("falls back to undefined priority for unknown request types", () => {
    expect(getRequestPriorityInfo("Seguro").key).toBe("undefined");
  });

  it("sorts requests by priority rank before created date", () => {
    const sorted = sortRequestsByPriority(
      [
        { id: "3", created_at: "2026-04-01T09:00:00Z", request_types: { name: "Prestamo" } },
        { id: "1", created_at: "2026-04-02T09:00:00Z", request_types: { name: "Combustible" } },
        { id: "2", created_at: "2026-04-03T09:00:00Z", request_types: { name: "Mantencion" } },
      ],
      (request) => request.request_types.name,
      (request) => request.created_at,
    );

    expect(sorted.map((request) => request.id)).toEqual(["1", "2", "3"]);
  });

  it("prioritizes older requests when the type priority is the same", () => {
    const sorted = sortRequestsByPriority(
      [
        { id: "newer", created_at: "2026-04-03T09:00:00Z", request_types: { name: "Prestamo" } },
        { id: "older", created_at: "2026-03-20T09:00:00Z", request_types: { name: "Prestamo" } },
      ],
      (request) => request.request_types.name,
      (request) => request.created_at,
    );

    expect(sorted.map((request) => request.id)).toEqual(["older", "newer"]);
  });

  it("builds the dashboard breakdown summary in priority order", () => {
    const breakdown = buildRequestPriorityBreakdown(
      [
        { request_types: { name: "Anticipo" } },
        { request_types: { name: "Combustible" } },
        { request_types: { name: "Combustible" } },
      ],
      (request) => request.request_types.name,
    );

    expect(breakdown.map((item) => item.summaryText)).toEqual([
      "2 urgentes (Combustible)",
      "1 muy baja (Anticipo)",
    ]);
  });
});
