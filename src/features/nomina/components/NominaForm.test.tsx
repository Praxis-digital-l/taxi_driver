import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import NominaForm from "./NominaForm";
import { fetchAdminConductores, type ConductorRecord } from "@/features/admin/services/adminConductoresService";
import {
  fetchAdminVehiclesData,
  type VehicleAssignmentRecord,
  type VehicleRecord,
} from "@/features/admin/services/adminVehiclesService";
import { type DatosNomina } from "@/lib/nomina";

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/features/admin/services/adminConductoresService", () => ({
  fetchAdminConductores: vi.fn(),
}));

vi.mock("@/features/admin/services/adminVehiclesService", () => ({
  fetchAdminVehiclesData: vi.fn(),
}));

const conductor: ConductorRecord = {
  id: "profile-1",
  user_id: "user-1",
  nombres: "Ana",
  apellido_paterno: "Gómez",
  apellido_materno: "",
  full_name: "Ana Gómez",
  email: "ana@test.com",
  phone: null,
  rut: "11.111.111-1",
  worker_id: "COND-001",
  score: null,
  estado_conductor: "activo",
  photo_url: null,
  role: "conductor",
  created_at: "",
  updated_at: "",
};

const vehiculo: VehicleRecord = {
  id: "veh-1",
  license_plate: "PSXJ-30",
  make: "Toyota",
  model: "Yaris",
  year: 2022,
  color: "Blanco",
  status: "activo",
};

const datos: DatosNomina = {
  trabajadorId: "COND-001",
  nombre: "Ana Gómez",
  email: "ana@test.com",
  rut: "11.111.111-1",
  estadoConductor: "activo",
  totalFacturado: 1500000,
  gastoOperacional: 100000,
  diesel: 200000,
  tag: { Autopista: 1000 },
  arriendo: 150000,
  seguro: 50000,
  mantencion: 80000,
  anticipo: 100000,
  prestamo: 50000,
  descuentosExtra: [],
  efectivoMonto: 30000,
  vehicle_id: "veh-1",
  vehicle_plate: "PSXJ-30",
  vehicle_make: "Toyota",
  vehicle_model: "Yaris",
  vehicle_year: 2022,
};

function configurarCatalogo(vehicles: VehicleRecord[], assignments: VehicleAssignmentRecord[]) {
  vi.mocked(fetchAdminConductores).mockResolvedValue([conductor]);
  vi.mocked(fetchAdminVehiclesData).mockResolvedValue({
    vehicles,
    conductors: [conductor],
    assignments,
  });
}

describe("NominaForm al reabrir una preliquidación", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("muestra el vehículo guardado aunque no tenga asignación activa", async () => {
    configurarCatalogo([vehiculo], []);

    render(
      <NominaForm
        onCalcular={vi.fn()}
        onGuardarPreliquidacion={vi.fn()}
        datosIniciales={datos}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByText(/PSXJ-30/).length).toBeGreaterThanOrEqual(2);
    });
    expect(screen.getByDisplayValue("$ 1.000")).toBeInTheDocument();
    expect(screen.queryByText(/no tiene vehículos asignados/i)).not.toBeInTheDocument();
  });

  it("muestra el vehículo guardado aunque ya no esté en el catálogo", async () => {
    configurarCatalogo([], []);

    render(
      <NominaForm
        onCalcular={vi.fn()}
        onGuardarPreliquidacion={vi.fn()}
        datosIniciales={datos}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByText(/PSXJ-30/).length).toBeGreaterThanOrEqual(2);
    });
    expect(screen.queryByText(/no tiene vehículos asignados/i)).not.toBeInTheDocument();
  });
});
