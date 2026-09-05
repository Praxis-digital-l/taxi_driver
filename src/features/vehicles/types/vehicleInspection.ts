export type PartCondition = "good" | "warning" | "damaged";

export type IssueType = 
  | "rayon"
  | "abolladura"
  | "mecanico"
  | "desgaste"
  | "vidrio"
  | "limpieza"
  | "luces"
  | "neumatico"
  | "otro";

export type ObservationStatus = "pendiente" | "en_revision" | "reparado";

export interface VehiclePartDefinition {
  key: string;
  name: string;
  category: "Carrocería" | "Puertas y Ventanas" | "Neumáticos y Frenos" | "Mecánica y Motor" | "Luces y Espejos" | "Interior";
  description?: string;
  svgRegion?: string;
}

export interface VehicleObservation {
  id: string;
  vehicle_id: string;
  profile_id: string;
  part_key: string;
  part_name: string;
  condition: PartCondition;
  issue_type: IssueType;
  description: string;
  status: ObservationStatus;
  created_at: string;
  updated_at: string;
  profiles?: {
    id: string;
    full_name: string;
    role: string;
    email?: string;
  } | null;
}

export const VEHICLE_PARTS: VehiclePartDefinition[] = [
  // Carrocería
  { key: "hood", name: "Capó", category: "Carrocería" },
  { key: "windshield", name: "Parabrisas", category: "Carrocería" },
  { key: "roof", name: "Techo", category: "Carrocería" },
  { key: "rear_windshield", name: "Luneta Trasera", category: "Carrocería" },
  { key: "trunk", name: "Maletero", category: "Carrocería" },
  { key: "front_bumper", name: "Parachoques Delantero", category: "Carrocería" },
  { key: "rear_bumper", name: "Parachoques Trasero", category: "Carrocería" },

  // Puertas y Ventanas
  { key: "front_left_door", name: "Puerta Delantera Izquierda", category: "Puertas y Ventanas" },
  { key: "front_right_door", name: "Puerta Delantera Derecha", category: "Puertas y Ventanas" },
  { key: "rear_left_door", name: "Puerta Trasera Izquierda", category: "Puertas y Ventanas" },
  { key: "rear_right_door", name: "Puerta Trasera Derecha", category: "Puertas y Ventanas" },

  // Neumáticos y Frenos
  { key: "front_left_tire", name: "Neumático Delantero Izquierdo", category: "Neumáticos y Frenos" },
  { key: "front_right_tire", name: "Neumático Delantero Derecho", category: "Neumáticos y Frenos" },
  { key: "rear_left_tire", name: "Neumático Trasero Izquierdo", category: "Neumáticos y Frenos" },
  { key: "rear_right_tire", name: "Neumático Trasero Derecho", category: "Neumáticos y Frenos" },
  { key: "brakes", name: "Frenos y Discos", category: "Neumáticos y Frenos" },
  { key: "suspension", name: "Suspensión", category: "Neumáticos y Frenos" },

  // Mecánica y Motor
  { key: "engine", name: "Motor", category: "Mecánica y Motor" },
  { key: "battery", name: "Batería", category: "Mecánica y Motor" },
  { key: "radiator", name: "Radiador y Refrigerante", category: "Mecánica y Motor" },
  { key: "gas_tank", name: "Estanque de Combustible", category: "Mecánica y Motor" },
  { key: "muffler", name: "Escape y Silenciador", category: "Mecánica y Motor" },

  // Luces y Espejos
  { key: "left_headlight", name: "Foco Delantero Izquierdo", category: "Luces y Espejos" },
  { key: "right_headlight", name: "Foco Delantero Derecho", category: "Luces y Espejos" },
  { key: "left_taillight", name: "Luz Trasera Izquierda", category: "Luces y Espejos" },
  { key: "right_taillight", name: "Luz Trasera Derecha", category: "Luces y Espejos" },
  { key: "mirrors", name: "Espejos Retrovisores", category: "Luces y Espejos" },

  // Interior
  { key: "driver_seat", name: "Asiento del Conductor", category: "Interior" },
  { key: "passenger_seats", name: "Asientos Pasajeros", category: "Interior" },
  { key: "dashboard", name: "Tablero e Instrumentos", category: "Interior" },
];

export const ISSUE_TYPE_LABELS: Record<IssueType, string> = {
  rayon: "Rayón / Pintura",
  abolladura: "Golpe / Abolladura",
  mecanico: "Falla Mecánica",
  desgaste: "Desgaste",
  vidrio: "Vidrio Picado / Triza",
  limpieza: "Limpieza / Tapiz",
  luces: "Luz Quemada / Rotura",
  neumatico: "Pinchazo / Baja Presión",
  otro: "Otro detalle",
};

