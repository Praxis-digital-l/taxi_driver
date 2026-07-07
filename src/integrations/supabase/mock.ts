/* eslint-disable @typescript-eslint/no-explicit-any */

type AppRole = "admin" | "conductor" | "super_admin";

type MockUserRecord = {
  id: string;
  email: string;
  password: string;
  profile_id: string;
  role: AppRole;
};

type MockSession = {
  user: {
    id: string;
    email: string;
    user_metadata?: Record<string, unknown>;
  };
  access_token: string;
};

type AuthCallback = (event: string, session: MockSession | null) => void;

type FilterOperator = "eq" | "in" | "gte" | "lte" | "not";

type FilterClause = {
  operator: FilterOperator;
  column: string;
  value?: any;
  values?: any[];
  comparator?: string;
};

type RowRecord = Record<string, any>;

const nowIso = () => new Date().toISOString();

const generateId = (prefix: string) => {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${randomPart}`;
};

const DEFAULT_PASSWORD = "123456";

const initialUsers: MockUserRecord[] = [
  {
    id: "user-admin-1",
    email: "admincorto@santaaurora.cl",
    password: DEFAULT_PASSWORD,
    profile_id: "profile-admin-1",
    role: "super_admin",
  },
  {
    id: "user-admin-2",
    email: "admin.flota@santaaurora.cl",
    password: DEFAULT_PASSWORD,
    profile_id: "profile-admin-2",
    role: "admin",
  },
  {
    id: "user-cond-1",
    email: "antonia.gajardo@demo-flota.cl",
    password: DEFAULT_PASSWORD,
    profile_id: "profile-cond-1",
    role: "conductor",
  },
  {
    id: "user-cond-2",
    email: "camila.soto@demo-flota.cl",
    password: DEFAULT_PASSWORD,
    profile_id: "profile-cond-2",
    role: "conductor",
  },
  {
    id: "user-cond-3",
    email: "francisca.henriquez@demo-flota.cl",
    password: DEFAULT_PASSWORD,
    profile_id: "profile-cond-3",
    role: "conductor",
  },
  {
    id: "user-cond-4",
    email: "diego.vargas@demo-flota.cl",
    password: DEFAULT_PASSWORD,
    profile_id: "profile-cond-4",
    role: "conductor",
  },
  {
    id: "user-cond-5",
    email: "bruno.sanmartin@demo-flota.cl",
    password: DEFAULT_PASSWORD,
    profile_id: "profile-cond-5",
    role: "conductor",
  },
  {
    id: "user-cond-6",
    email: "matias.rojas@demo-flota.cl",
    password: DEFAULT_PASSWORD,
    profile_id: "profile-cond-6",
    role: "conductor",
  },
];

const initialProfiles = [
  {
    id: "profile-admin-1",
    user_id: "user-admin-1",
    full_name: "Admin Principal",
    email: "admincorto@santaaurora.cl",
    phone: "+56 9 7777 0001",
    role: "super_admin",
    created_at: nowIso(),
    updated_at: nowIso(),
  },
  {
    id: "profile-admin-2",
    user_id: "user-admin-2",
    full_name: "Admin Operaciones",
    email: "admin.flota@santaaurora.cl",
    phone: "+56 9 7777 0002",
    role: "admin",
    created_at: nowIso(),
    updated_at: nowIso(),
  },
  {
    id: "profile-cond-1",
    user_id: "user-cond-1",
    full_name: "Antonia Gajardo",
    email: "antonia.gajardo@demo-flota.cl",
    phone: "+56 9 1111 1001",
    role: "conductor",
    created_at: nowIso(),
    updated_at: nowIso(),
  },
  {
    id: "profile-cond-2",
    user_id: "user-cond-2",
    full_name: "Camila Soto Paredes",
    email: "camila.soto@demo-flota.cl",
    phone: "+56 9 1723 2101",
    role: "conductor",
    created_at: nowIso(),
    updated_at: nowIso(),
  },
  {
    id: "profile-cond-3",
    user_id: "user-cond-3",
    full_name: "Francisca Henríquez Tapia",
    email: "francisca.henriquez@demo-flota.cl",
    phone: "+56 9 2222 2003",
    role: "conductor",
    created_at: nowIso(),
    updated_at: nowIso(),
  },
  {
    id: "profile-cond-4",
    user_id: "user-cond-4",
    full_name: "Diego Vargas",
    email: "diego.vargas@demo-flota.cl",
    phone: "+56 9 3333 3004",
    role: "conductor",
    created_at: nowIso(),
    updated_at: nowIso(),
  },
  {
    id: "profile-cond-5",
    user_id: "user-cond-5",
    full_name: "Bruno San Martín",
    email: "bruno.sanmartin@demo-flota.cl",
    phone: "+56 9 4444 4005",
    role: "conductor",
    created_at: nowIso(),
    updated_at: nowIso(),
  },
  {
    id: "profile-cond-6",
    user_id: "user-cond-6",
    full_name: "Matías Rojas",
    email: "matias.rojas@demo-flota.cl",
    phone: "+56 9 5555 5006",
    role: "conductor",
    created_at: nowIso(),
    updated_at: nowIso(),
  },
];

const initialVehicles = [
  { id: "veh-1", license_plate: "BVRK-20", make: "Kia", model: "Frontier", year: 2018, color: "Blanco", status: "maintenance" },
  { id: "veh-2", license_plate: "BCXR-14", make: "Hyundai", model: "Porter", year: 2021, color: "Blanco", status: "active" },
  { id: "veh-3", license_plate: "BTQP-18", make: "Chevrolet", model: "N300", year: 2019, color: "Gris", status: "active" },
  { id: "veh-4", license_plate: "CVDR-29", make: "Toyota", model: "Hiace", year: 2020, color: "Plata", status: "active" },
  { id: "veh-5", license_plate: "DBSS-73", make: "Peugeot", model: "Partner", year: 2017, color: "Blanco", status: "inactive" },
  { id: "veh-6", license_plate: "ECTU-41", make: "Nissan", model: "NP300", year: 2022, color: "Rojo", status: "active" },
  { id: "veh-7", license_plate: "FMVZ-63", make: "Maxus", model: "T60", year: 2023, color: "Negro", status: "active" },
  { id: "veh-8", license_plate: "GHTP-83", make: "Ford", model: "Ranger", year: 2021, color: "Azul", status: "maintenance" },
];

const initialVehicleAssignments = [
  { id: "va-1", vehicle_id: "veh-1", profile_id: "profile-cond-2", assigned_at: nowIso() },
  { id: "va-2", vehicle_id: "veh-2", profile_id: "profile-cond-1", assigned_at: nowIso() },
  { id: "va-3", vehicle_id: "veh-3", profile_id: "profile-cond-3", assigned_at: nowIso() },
  { id: "va-4", vehicle_id: "veh-4", profile_id: "profile-cond-4", assigned_at: nowIso() },
  { id: "va-5", vehicle_id: "veh-5", profile_id: "profile-cond-5", assigned_at: nowIso() },
  { id: "va-6", vehicle_id: "veh-6", profile_id: "profile-cond-6", assigned_at: nowIso() },
];

const initialDocumentTypes = [
  { id: "dt-1", name: "Liquidación de sueldo" },
  { id: "dt-2", name: "Factura Taller" },
  { id: "dt-3", name: "Compra de combustible" },
  { id: "dt-4", name: "Factura TAG" },
  { id: "dt-5", name: "Permiso fuera RM" },
  { id: "dt-6", name: "Seguro comercial" },
  { id: "dt-7", name: "Seguro de asiento" },
  { id: "dt-8", name: "Boleta repuestos" },
];

const initialRequestTypes = [
  { id: "rt-1", name: "Anticipo de sueldo" },
  { id: "rt-2", name: "Préstamo" },
  { id: "rt-3", name: "Compra combustible" },
  { id: "rt-4", name: "Mantención" },
  { id: "rt-5", name: "Compra repuestos" },
  { id: "rt-6", name: "Permiso fuera RM" },
];

const initialDocuments = [
  {
    id: "doc-1",
    profile_id: "profile-cond-2",
    document_type_id: "dt-3",
    vehicle_id: "veh-1",
    file_key: "seed/profile-cond-2/combustible-bvrk20.pdf",
    file_url: "https://mock.local/documents/combustible-bvrk20.pdf",
    description: "Boleta combustible ruta norte",
    status: "pendiente",
    expiration_date: null,
    created_at: nowIso(),
    updated_at: nowIso(),
  },
  {
    id: "doc-2",
    profile_id: "profile-cond-2",
    document_type_id: "dt-6",
    vehicle_id: "veh-1",
    file_key: "seed/profile-cond-2/seguro-comercial-bvrk20.pdf",
    file_url: "https://mock.local/documents/seguro-comercial-bvrk20.pdf",
    description: "Seguro comercial anual",
    status: "aprobado",
    expiration_date: new Date(Date.now() + 12 * 86400000).toISOString().slice(0, 10),
    created_at: nowIso(),
    updated_at: nowIso(),
  },
  {
    id: "doc-3",
    profile_id: "profile-cond-1",
    document_type_id: "dt-1",
    vehicle_id: "veh-2",
    file_key: "seed/profile-cond-1/liquidacion-marzo.pdf",
    file_url: "https://mock.local/documents/liquidacion-marzo.pdf",
    description: "Liquidación marzo",
    status: "aprobado",
    expiration_date: null,
    created_at: nowIso(),
    updated_at: nowIso(),
  },
  {
    id: "doc-4",
    profile_id: "profile-cond-3",
    document_type_id: "dt-2",
    vehicle_id: "veh-3",
    file_key: "seed/profile-cond-3/factura-taller.jpg",
    file_url: "https://mock.local/documents/factura-taller.jpg",
    description: "Cambio de frenos",
    status: "pendiente",
    expiration_date: null,
    created_at: nowIso(),
    updated_at: nowIso(),
  },
];

const initialRequests = [
  {
    id: "req-1",
    profile_id: "profile-cond-2",
    request_type_id: "rt-3",
    vehicle_id: "veh-1",
    details: "Carga de combustible para ruta del lunes.",
    amount: 85000,
    status: "pendiente",
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    updated_at: nowIso(),
  },
  {
    id: "req-2",
    profile_id: "profile-cond-2",
    request_type_id: "rt-4",
    vehicle_id: "veh-1",
    details: "Ruido en frenos al detenerse.",
    amount: 150000,
    status: "en_proceso",
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    updated_at: nowIso(),
  },
  {
    id: "req-3",
    profile_id: "profile-cond-1",
    request_type_id: "rt-1",
    vehicle_id: "veh-2",
    details: "Solicito anticipo para gastos médicos.",
    amount: 120000,
    status: "pendiente",
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    updated_at: nowIso(),
  },
  {
    id: "req-4",
    profile_id: "profile-cond-3",
    request_type_id: "rt-5",
    vehicle_id: "veh-3",
    details: "Compra de neumático delantero.",
    amount: 98000,
    status: "completado",
    created_at: new Date(Date.now() - 9 * 86400000).toISOString(),
    updated_at: nowIso(),
  },
];

const initialMileage = [
  { id: "km-1", profile_id: "profile-cond-2", vehicle_id: "veh-1", kilometers: 84510, recorded_date: "2026-03-28", notes: "Ruta mañana", created_at: nowIso() },
  { id: "km-2", profile_id: "profile-cond-2", vehicle_id: "veh-1", kilometers: 85120, recorded_date: "2026-04-01", notes: "Ruta tarde", created_at: nowIso() },
  { id: "km-3", profile_id: "profile-cond-1", vehicle_id: "veh-2", kilometers: 62310, recorded_date: "2026-04-02", notes: "", created_at: nowIso() },
  { id: "km-4", profile_id: "profile-cond-3", vehicle_id: "veh-3", kilometers: 73450, recorded_date: "2026-03-30", notes: "Control semanal", created_at: nowIso() },
];

const initialMessages = [
  {
    id: "msg-1",
    sender_id: "profile-admin-1",
    receiver_id: "profile-cond-2",
    content: "Revisar estado de documentos y combustible para la ruta de hoy.",
    status: "pendiente",
    read_at: null,
    created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
  },
  {
    id: "msg-2",
    sender_id: "profile-admin-2",
    receiver_id: "profile-cond-2",
    content: "Confirmar compra de repuestos y subir factura.",
    status: "en_proceso",
    read_at: null,
    created_at: new Date(Date.now() - 20 * 3600000).toISOString(),
  },
  {
    id: "msg-3",
    sender_id: "profile-admin-1",
    receiver_id: "profile-cond-1",
    content: "Subir comprobante de TAG antes del viernes.",
    status: "pendiente",
    read_at: null,
    created_at: new Date(Date.now() - 36 * 3600000).toISOString(),
  },
];

const initialAdminNotes = [
  {
    id: "note-1",
    vehicle_id: "veh-1",
    admin_id: "profile-admin-1",
    note_text: "Cliente reporta demora en respuesta de mantención.",
    created_at: new Date(Date.now() - 4 * 86400000).toISOString(),
    updated_at: nowIso(),
  },
];

const mockDb: Record<string, RowRecord[]> = {
  profiles: initialProfiles,
  vehicles: initialVehicles,
  vehicle_assignments: initialVehicleAssignments,
  document_types: initialDocumentTypes,
  request_types: initialRequestTypes,
  documents: initialDocuments,
  requests: initialRequests,
  mileage_records: initialMileage,
  messages: initialMessages,
  admin_notes: initialAdminNotes,
};

const mockStorage = new Map<string, Blob>();
for (const document of initialDocuments) {
  mockStorage.set(document.file_key, new Blob([`Mock file for ${document.file_key}`], { type: "application/pdf" }));
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

function getTableRows(table: string) {
  if (!mockDb[table]) {
    mockDb[table] = [];
  }
  return mockDb[table];
}

function normalizeComparableValue(value: any) {
  if (value === null || value === undefined) return value;
  if (typeof value === "number") return value;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/u.test(value)) return value;
  return String(value).toLowerCase();
}

function applyFilter(rows: RowRecord[], filter: FilterClause): RowRecord[] {
  if (filter.operator === "eq") {
    return rows.filter((row) => row[filter.column] === filter.value);
  }

  if (filter.operator === "in") {
    const values = filter.values ?? [];
    return rows.filter((row) => values.includes(row[filter.column]));
  }

  if (filter.operator === "gte") {
    const expected = normalizeComparableValue(filter.value);
    return rows.filter((row) => normalizeComparableValue(row[filter.column]) >= expected);
  }

  if (filter.operator === "lte") {
    const expected = normalizeComparableValue(filter.value);
    return rows.filter((row) => normalizeComparableValue(row[filter.column]) <= expected);
  }

  if (filter.operator === "not") {
    if (filter.comparator === "is" && filter.value === null) {
      return rows.filter((row) => row[filter.column] !== null && row[filter.column] !== undefined);
    }
    return rows;
  }

  return rows;
}

function attachRelations(table: string, row: RowRecord, columns: string): RowRecord {
  const response = { ...row };

  const addProfile = (fieldName: string, profileId?: string, full = false) => {
    if (!profileId) return;
    const profile = getTableRows("profiles").find((item) => item.id === profileId);
    if (!profile) return;
    response[fieldName] = full
      ? clone(profile)
      : { full_name: profile.full_name, email: profile.email, phone: profile.phone, id: profile.id };
  };

  const addVehicle = (fieldName: string, vehicleId?: string, full = false) => {
    if (!vehicleId) return;
    const vehicle = getTableRows("vehicles").find((item) => item.id === vehicleId);
    if (!vehicle) return;
    response[fieldName] = full ? clone(vehicle) : { license_plate: vehicle.license_plate, id: vehicle.id };
  };

  if (table === "documents") {
    if (columns.includes("document_types(")) {
      const type = getTableRows("document_types").find((item) => item.id === row.document_type_id);
      response.document_types = type ? { name: type.name } : null;
    }
    if (columns.includes("profiles(")) addProfile("profiles", row.profile_id, columns.includes("profiles(*)"));
    if (columns.includes("vehicles(")) addVehicle("vehicles", row.vehicle_id, columns.includes("vehicles(*)"));
  }

  if (table === "requests") {
    if (columns.includes("request_types(")) {
      const requestType = getTableRows("request_types").find((item) => item.id === row.request_type_id);
      response.request_types = requestType ? { name: requestType.name } : null;
    }
    if (columns.includes("profiles(")) addProfile("profiles", row.profile_id, columns.includes("profiles(*)"));
    if (columns.includes("vehicles(")) addVehicle("vehicles", row.vehicle_id, columns.includes("vehicles(*)"));
  }

  if (table === "mileage_records") {
    if (columns.includes("profiles(")) addProfile("profiles", row.profile_id, columns.includes("profiles(*)"));
    if (columns.includes("vehicles(")) addVehicle("vehicles", row.vehicle_id, columns.includes("vehicles(*)"));
  }

  if (table === "vehicle_assignments") {
    if (columns.includes("profiles(")) addProfile("profiles", row.profile_id, columns.includes("profiles(*)"));
    if (columns.includes("vehicles(")) addVehicle("vehicles", row.vehicle_id, columns.includes("vehicles(*)"));
  }

  if (table === "messages") {
    if (columns.includes("sender:profiles!messages_sender_id_fkey(")) {
      const sender = getTableRows("profiles").find((item) => item.id === row.sender_id);
      response.sender = sender ? { full_name: sender.full_name } : null;
    }
    if (columns.includes("receiver:profiles!messages_receiver_id_fkey(")) {
      const receiver = getTableRows("profiles").find((item) => item.id === row.receiver_id);
      response.receiver = receiver ? { full_name: receiver.full_name } : null;
    }
  }

  return response;
}

class MockQueryBuilder {
  private readonly table: string;
  private operation: "select" | "insert" | "update" | "delete" = "select";
  private selectedColumns = "*";
  private selectOptions: { count?: string; head?: boolean } = {};
  private filters: FilterClause[] = [];
  private orderBy: { column: string; ascending: boolean } | null = null;
  private maxRows: number | null = null;
  private expectSingle = false;
  private allowEmptySingle = false;
  private insertPayload: RowRecord[] = [];
  private updatePayload: RowRecord = {};

  constructor(table: string) {
    this.table = table;
  }

  select(columns = "*", options?: { count?: string; head?: boolean }) {
    this.operation = "select";
    this.selectedColumns = columns;
    this.selectOptions = options ?? {};
    return this;
  }

  insert(payload: RowRecord | RowRecord[]) {
    this.operation = "insert";
    this.insertPayload = Array.isArray(payload) ? payload : [payload];
    return this;
  }

  update(payload: RowRecord) {
    this.operation = "update";
    this.updatePayload = payload;
    return this;
  }

  delete() {
    this.operation = "delete";
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push({ operator: "eq", column, value });
    return this;
  }

  in(column: string, values: any[]) {
    this.filters.push({ operator: "in", column, values });
    return this;
  }

  gte(column: string, value: any) {
    this.filters.push({ operator: "gte", column, value });
    return this;
  }

  lte(column: string, value: any) {
    this.filters.push({ operator: "lte", column, value });
    return this;
  }

  not(column: string, comparator: string, value: any) {
    this.filters.push({ operator: "not", column, comparator, value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: options?.ascending !== false };
    return this;
  }

  limit(amount: number) {
    this.maxRows = amount;
    return this;
  }

  single() {
    this.expectSingle = true;
    this.allowEmptySingle = false;
    return this;
  }

  maybeSingle() {
    this.expectSingle = true;
    this.allowEmptySingle = true;
    return this;
  }

  private runSelect() {
    const originalRows = getTableRows(this.table);
    let rows = [...originalRows];

    for (const filter of this.filters) {
      rows = applyFilter(rows, filter);
    }

    const count = rows.length;

    if (this.orderBy) {
      const { column, ascending } = this.orderBy;
      rows.sort((a, b) => {
        const av = a[column] ?? "";
        const bv = b[column] ?? "";
        if (av < bv) return ascending ? -1 : 1;
        if (av > bv) return ascending ? 1 : -1;
        return 0;
      });
    }

    if (this.maxRows !== null) {
      rows = rows.slice(0, this.maxRows);
    }

    const mappedRows = rows.map((row) => attachRelations(this.table, clone(row), this.selectedColumns));

    if (this.expectSingle) {
      if (mappedRows.length === 0) {
        if (this.allowEmptySingle) {
          return { data: null, error: null, count: this.selectOptions.count ? count : null };
        }
        return { data: null, error: { message: "No rows found" }, count: this.selectOptions.count ? count : null };
      }
      return { data: mappedRows[0], error: null, count: this.selectOptions.count ? count : null };
    }

    if (this.selectOptions.head) {
      return { data: null, error: null, count: this.selectOptions.count ? count : null };
    }

    return {
      data: mappedRows,
      error: null,
      count: this.selectOptions.count ? count : null,
    };
  }

  private runInsert() {
    const tableRows = getTableRows(this.table);
    const createdRows: RowRecord[] = [];

    for (const payload of this.insertPayload) {
      if (this.table === "vehicle_assignments") {
        const duplicated = tableRows.find(
          (row) => row.vehicle_id === payload.vehicle_id && row.profile_id === payload.profile_id,
        );
        if (duplicated) {
          return {
            data: null,
            error: {
              message: "duplicate key value violates unique constraint",
              code: "23505",
            },
            count: null,
          };
        }
      }

      const timestamp = nowIso();
      const baseRow: RowRecord = {
        id: payload.id ?? generateId(this.table),
        ...payload,
      };

      if (this.table === "documents") {
        baseRow.status = payload.status ?? "pendiente";
        baseRow.updated_at = timestamp;
        baseRow.created_at = payload.created_at ?? timestamp;
      }

      if (this.table === "requests") {
        baseRow.status = payload.status ?? "pendiente";
        baseRow.updated_at = timestamp;
        baseRow.created_at = payload.created_at ?? timestamp;
      }

      if (this.table === "messages") {
        baseRow.status = payload.status ?? "pendiente";
        baseRow.read_at = payload.read_at ?? null;
        baseRow.created_at = payload.created_at ?? timestamp;
      }

      if (this.table === "admin_notes") {
        baseRow.created_at = payload.created_at ?? timestamp;
        baseRow.updated_at = payload.updated_at ?? timestamp;
      }

      if (this.table === "mileage_records") {
        baseRow.created_at = payload.created_at ?? timestamp;
      }

      if (this.table === "vehicles") {
        baseRow.status = payload.status ?? "active";
      }

      if (this.table === "vehicle_assignments") {
        baseRow.assigned_at = payload.assigned_at ?? timestamp;
      }

      tableRows.push(baseRow);
      createdRows.push(clone(baseRow));
    }

    return { data: createdRows, error: null, count: null };
  }

  private runUpdate() {
    const tableRows = getTableRows(this.table);
    let updatedCount = 0;

    for (const row of tableRows) {
      const passes = this.filters.every((filter) => applyFilter([row], filter).length === 1);
      if (!passes) continue;

      Object.assign(row, this.updatePayload);
      if ("updated_at" in row) {
        row.updated_at = nowIso();
      }
      updatedCount += 1;
    }

    return { data: [], error: null, count: updatedCount };
  }

  private runDelete() {
    const tableRows = getTableRows(this.table);

    if (this.table === "vehicles") {
      const targetIds = tableRows
        .filter((row) => this.filters.every((filter) => applyFilter([row], filter).length === 1))
        .map((row) => row.id);

      const hasAssignments = getTableRows("vehicle_assignments").some((assignment) =>
        targetIds.includes(assignment.vehicle_id),
      );

      if (hasAssignments) {
        return {
          data: null,
          error: {
            message: "update or delete on table vehicles violates foreign key constraint on vehicle_assignments",
            code: "23503",
            details: "vehicle_assignments still references this vehicle",
          },
          count: null,
        };
      }
    }

    const keptRows: RowRecord[] = [];
    let removedCount = 0;

    for (const row of tableRows) {
      const shouldDelete = this.filters.every((filter) => applyFilter([row], filter).length === 1);
      if (shouldDelete) {
        removedCount += 1;
      } else {
        keptRows.push(row);
      }
    }

    mockDb[this.table] = keptRows;
    return { data: [], error: null, count: removedCount };
  }

  private async execute() {
    if (this.operation === "select") return this.runSelect();
    if (this.operation === "insert") return this.runInsert();
    if (this.operation === "update") return this.runUpdate();
    return this.runDelete();
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }

  catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null) {
    return this.execute().catch(onrejected);
  }

  finally(onfinally?: (() => void) | null) {
    return this.execute().finally(onfinally ?? undefined);
  }
}

class MockStorageBucket {
  constructor(private readonly bucketName: string) {}

  async upload(fileKey: string, file: Blob) {
    mockStorage.set(fileKey, file);
    return { data: { path: fileKey, bucket: this.bucketName }, error: null };
  }

  getPublicUrl(fileKey: string) {
    return {
      data: {
        publicUrl: `https://mock.local/${this.bucketName}/${encodeURIComponent(fileKey)}`,
      },
    };
  }

  async createSignedUrl(fileKey: string, _expiresInSeconds: number) {
    if (!mockStorage.has(fileKey)) {
      const fallback = `Archivo mock no encontrado: ${fileKey}`;
      const signedUrl = `data:text/plain;charset=utf-8,${encodeURIComponent(fallback)}`;
      return { data: { signedUrl }, error: null };
    }

    const blob = mockStorage.get(fileKey)!;
    const signedUrl = URL.createObjectURL(blob);
    return { data: { signedUrl }, error: null };
  }

  async remove(fileKeys: string[]) {
    for (const key of fileKeys) {
      mockStorage.delete(key);
    }
    return { data: null, error: null };
  }
}

class MockStorageClient {
  from(bucketName: string) {
    return new MockStorageBucket(bucketName);
  }
}

class MockSupabaseAuth {
  private listeners: AuthCallback[] = [];
  private currentSession: MockSession | null = null;
  private usersByEmail = new Map<string, MockUserRecord>();

  constructor() {
    for (const user of initialUsers) {
      this.usersByEmail.set(user.email.toLowerCase(), user);
    }

    const stored = localStorage.getItem("mock-auth-session");
    if (stored) {
      try {
        this.currentSession = JSON.parse(stored);
      } catch {
        this.currentSession = null;
      }
    }
  }

  private saveSession(session: MockSession | null) {
    if (session) {
      localStorage.setItem("mock-auth-session", JSON.stringify(session));
    } else {
      localStorage.removeItem("mock-auth-session");
    }
  }

  private notifyListeners(event: string) {
    for (const callback of this.listeners) {
      callback(event, this.currentSession);
    }
  }

  async signInWithPassword(credentials: { email: string; password: string }) {
    const email = String(credentials?.email ?? "").trim().toLowerCase();
    const password = String(credentials?.password ?? "").trim();

    const user = this.usersByEmail.get(email);
    if (!user) {
      return { data: null, error: { message: `Usuario no encontrado: ${email}` } };
    }

    if (user.password !== password) {
      return { data: null, error: { message: "Invalid login credentials" } };
    }

    const session: MockSession = {
      user: {
        id: user.id,
        email: user.email,
      },
      access_token: `mock-token-${user.id}`,
    };

    this.currentSession = session;
    this.saveSession(session);
    this.notifyListeners("SIGNED_IN");

    return {
      data: { user: session.user, session },
      error: null,
    };
  }

  async signUp(params: { email: string; password: string; options?: { data?: Record<string, unknown> } }) {
    const email = String(params?.email ?? "").trim().toLowerCase();
    const password = String(params?.password ?? "").trim();

    if (!email || password.length < 6) {
      return { data: null, error: { message: "Datos inválidos" } };
    }

    if (this.usersByEmail.has(email)) {
      return { data: null, error: { message: "El correo ya existe" } };
    }

    const userId = generateId("user");
    const profileId = generateId("profile");
    const fullName = String(params.options?.data?.full_name ?? "Nuevo Conductor").trim() || "Nuevo Conductor";

    const user: MockUserRecord = {
      id: userId,
      email,
      password,
      profile_id: profileId,
      role: "conductor",
    };

    this.usersByEmail.set(email, user);

    getTableRows("profiles").push({
      id: profileId,
      user_id: userId,
      full_name: fullName,
      email,
      phone: null,
      role: "conductor",
      created_at: nowIso(),
      updated_at: nowIso(),
    });

    const session: MockSession = {
      user: { id: userId, email },
      access_token: `mock-token-${userId}`,
    };

    this.currentSession = session;
    this.saveSession(session);
    this.notifyListeners("SIGNED_UP");

    return { data: { user: session.user, session }, error: null };
  }

  async signOut() {
    this.currentSession = null;
    this.saveSession(null);
    this.notifyListeners("SIGNED_OUT");
    return { error: null };
  }

  async getSession() {
    return { data: { session: this.currentSession }, error: null };
  }

  onAuthStateChange(callback: AuthCallback) {
    this.listeners.push(callback);
    callback("INITIAL_SESSION", this.currentSession);

    return {
      data: {
        subscription: {
          unsubscribe: () => {
            this.listeners = this.listeners.filter((listener) => listener !== callback);
          },
        },
      },
    };
  }
}

class MockSupabaseClient {
  auth: MockSupabaseAuth;
  storage: MockStorageClient;

  constructor() {
    this.auth = new MockSupabaseAuth();
    this.storage = new MockStorageClient();
  }

  from(table: string) {
    return new MockQueryBuilder(table);
  }
}

export const mockSupabase = new MockSupabaseClient();

export const MOCK_LOCAL_CREDENTIALS = {
  password: DEFAULT_PASSWORD,
  admins: [
    "admincorto@santaaurora.cl",
    "admin.flota@santaaurora.cl",
  ],
  conductors: initialUsers
    .filter((user) => user.role === "conductor")
    .map((user) => user.email),
};
