export type DescuentosTAG = {
  autopista1: number;
  autopista2: number;
  autopista3: number;
  autopista4: number;
  autopista5: number;
  autopista6: number;
  autopista7: number;
  autopista8: number;
};

export type DatosNomina = {
  trabajadorId: string;
  nombre: string;
  totalFacturado: number;
  gastoOperacional: number;
  diesel: number;
  tag: DescuentosTAG;
  arriendo: number;
  seguro: number;
  mantencion: number;
  anticipo: number;
  prestamo: number;
};

export type DetalleDescuento = {
  concepto: string;
  monto: number;
};

export type ResultadoNomina = {
  trabajadorId: string;
  nombre: string;
  totalFacturado: number;
  descuentosPrimarios: DetalleDescuento[];
  subtotal: number;
  descuentosSecundarios: DetalleDescuento[];
  totalDescuentos: number;
  totalAPagar: number;
};

export const NOMBRES_AUTOPISTAS = [
  "Autopista 1",
  "Autopista 2",
  "Autopista 3",
  "Autopista 4",
  "Autopista 5",
  "Autopista 6",
  "Autopista 7",
  "Autopista 8",
] as const;

export function crearDescuentosTAG(): DescuentosTAG {
  return {
    autopista1: 0, autopista2: 0, autopista3: 0, autopista4: 0,
    autopista5: 0, autopista6: 0, autopista7: 0, autopista8: 0,
  };
}

function totalTAG(tag: DescuentosTAG): number {
  return (
    tag.autopista1 + tag.autopista2 + tag.autopista3 + tag.autopista4 +
    tag.autopista5 + tag.autopista6 + tag.autopista7 + tag.autopista8
  );
}

function desgloseTAG(tag: DescuentosTAG): DetalleDescuento[] {
  return (Object.entries(tag) as [keyof DescuentosTAG, number][])
    .filter(([, monto]) => monto > 0)
    .map(([key, monto]) => {
      const match = key.match(/\d+$/);
      const idx = match ? parseInt(match[0], 10) - 1 : -1;
      return {
        concepto: `TAG - ${NOMBRES_AUTOPISTAS[idx] ?? key}`,
        monto,
      };
    });
}

function montoValido(valor: unknown): valor is number {
  return typeof valor === "number" && !Number.isNaN(valor) && valor >= 0;
}

export type ErrorValidacion = {
  campo: string;
  mensaje: string;
};

export function validarDatosNomina(data: Partial<DatosNomina>): ErrorValidacion[] {
  const errores: ErrorValidacion[] = [];

  if (!data.trabajadorId?.trim()) {
    errores.push({ campo: "trabajadorId", mensaje: "El ID del trabajador es obligatorio" });
  }
  if (!data.nombre?.trim()) {
    errores.push({ campo: "nombre", mensaje: "El nombre del trabajador es obligatorio" });
  }

  const validarCampo = (campo: string, valor: unknown, etiqueta: string) => {
    if (typeof valor !== "number" || Number.isNaN(valor) || valor < 0) {
      errores.push({ campo, mensaje: `${etiqueta} debe ser un número mayor o igual a 0` });
    }
  };

  validarCampo("totalFacturado", data.totalFacturado, "Total facturado");
  validarCampo("gastoOperacional", data.gastoOperacional, "Gasto operacional");
  validarCampo("diesel", data.diesel, "Diesel");
  validarCampo("arriendo", data.arriendo, "Arriendo");
  validarCampo("seguro", data.seguro, "Seguro");
  validarCampo("mantencion", data.mantencion, "Mantención");
  validarCampo("anticipo", data.anticipo, "Anticipo");
  validarCampo("prestamo", data.prestamo, "Préstamo");

  if (data.tag) {
    for (const [key, val] of Object.entries(data.tag)) {
      if (typeof val !== "number" || Number.isNaN(val) || val < 0) {
        errores.push({ campo: `tag.${key}`, mensaje: `El valor de TAG en ${key} debe ser un número mayor o igual a 0` });
      }
    }
  }

  return errores;
}

export function calcularNomina(data: DatosNomina): ResultadoNomina {
  const totalTAGValue = totalTAG(data.tag);

  const descuentosPrimarios: DetalleDescuento[] = [
    { concepto: "Gasto operacional", monto: data.gastoOperacional },
    { concepto: "Diesel", monto: data.diesel },
    ...desgloseTAG(data.tag),
    { concepto: "Arriendo", monto: data.arriendo },
    { concepto: "Seguro", monto: data.seguro },
  ];

  const subtotal = data.totalFacturado
    - data.gastoOperacional
    - data.diesel
    - totalTAGValue
    - data.arriendo
    - data.seguro;

  const descuentosSecundarios: DetalleDescuento[] = [
    { concepto: "Mantención", monto: data.mantencion },
    { concepto: "Anticipo", monto: data.anticipo },
    { concepto: "Préstamo", monto: data.prestamo },
  ];

  const totalDescuentosSecundarios = data.mantencion + data.anticipo + data.prestamo;
  const totalAPagar = subtotal - totalDescuentosSecundarios;

  return {
    trabajadorId: data.trabajadorId,
    nombre: data.nombre,
    totalFacturado: data.totalFacturado,
    descuentosPrimarios,
    subtotal,
    descuentosSecundarios,
    totalDescuentos: totalTAGValue + data.gastoOperacional + data.diesel + data.arriendo + data.seguro + totalDescuentosSecundarios,
    totalAPagar,
  };
}
