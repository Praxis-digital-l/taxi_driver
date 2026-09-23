import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import PendientesPorFirmar from "./PendientesPorFirmar";
import { deleteLiquidacion, fetchLiquidacionesPendientesFirma } from "@/features/nomina/services/liquidacionesService";

vi.mock("@/features/nomina/services/liquidacionesService", () => ({
  fetchLiquidacionesPendientesFirma: vi.fn(),
  deleteLiquidacion: vi.fn(),
}));

describe("PendientesPorFirmar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn(() => false);
  });

  it("muestra un diálogo de confirmación antes de descartar una firma pendiente", async () => {
    vi.mocked(fetchLiquidacionesPendientesFirma).mockResolvedValue([
      {
        id: "liq-1",
        profile_id: "profile-1",
        worker_id: "worker-1",
        nombre: "Ana Gómez",
        email: "ana@test.com",
        rut: "11.111.111-1",
        total_facturado: 100000,
        descuentos_primarios: [],
        subtotal: 100000,
        descuentos_secundarios: [],
        total_descuentos: 0,
        total_a_pagar: 100000,
        mes: "septiembre",
        fecha: "2026-09",
        file_url: null,
        enviado_por: null,
        created_at: "2026-09-01T00:00:00Z",
        firma_estado: "pendiente",
        firma_url_empleador: "https://firma.example.com/liq-1",
      },
    ]);

    render(<PendientesPorFirmar />);

    expect(await screen.findByText("Ana Gómez")).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Descartar liquidación"));

    expect(screen.getByText("Descartar firma pendiente")).toBeInTheDocument();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Descartar firma/i }));

    await waitFor(() => {
      expect(deleteLiquidacion).toHaveBeenCalledWith("liq-1");
    });
  });
});
