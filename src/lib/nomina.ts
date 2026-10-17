export type DescuentosTAG = Record<string, number>;

export type DescuentoExtra = {
  descripcion: string;
  monto: number;
};

export type DatosNomina = {
  trabajadorId: string;
  nombre: string;
  email: string;
  rut: string;
  totalFacturado: number;
  gastoOperacional: number;
  diesel: number;
  tag: DescuentosTAG;
  arriendo: number;
  seguro: number;
  mantencion: number;
  anticipo: number;
  prestamo: number;
  descuentosExtra: DescuentoExtra[];
  efectivoMonto: number;
};

export type DetalleDescuento = {
  concepto: string;
  monto: number;
};

export type ResultadoNomina = {
  trabajadorId: string;
  nombre: string;
  email: string;
  rut: string;
  totalFacturado: number;
  descuentosPrimarios: DetalleDescuento[];
  subtotal: number;
  descuentosSecundarios: DetalleDescuento[];
  totalDescuentos: number;
  totalAPagar: number;
};

export function crearDescuentosTAG(): DescuentosTAG {
  return {};
}

function totalTAG(tag: DescuentosTAG): number {
  return Object.values(tag).reduce((sum, v) => sum + v, 0);
}

function desgloseTAG(tag: DescuentosTAG): DetalleDescuento[] {
  return Object.entries(tag)
    .filter(([, monto]) => monto > 0)
    .map(([nombre, monto]) => ({
      concepto: `TAG - ${nombre}`,
      monto,
    }));
}

function resumenTAG(tag: DescuentosTAG): DetalleDescuento[] {
  const total = totalTAG(tag);
  return total > 0 ? [{ concepto: "Total TAGs", monto: total }] : [];
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
    errores.push({ campo: "trabajadorId", mensaje: "Debe seleccionar un trabajador" });
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
  validarCampo("efectivoMonto", data.efectivoMonto, "Efectivo");

  (data.descuentosExtra ?? []).forEach((descuento, index) => {
    if (typeof descuento.monto !== "number" || Number.isNaN(descuento.monto) || descuento.monto < 0) {
      errores.push({
        campo: `descuentoExtra.${index}`,
        mensaje: "El monto del descuento extra debe ser un número mayor o igual a 0",
      });
    }
  });

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
    ...resumenTAG(data.tag),
    { concepto: "Arriendo", monto: data.arriendo },
    { concepto: "Seguro", monto: data.seguro },
    ...(data.efectivoMonto > 0 ? [{ concepto: "Efectivo", monto: data.efectivoMonto }] : []),
  ];

  const totalDescuentosPrimarios =
    data.gastoOperacional +
    data.diesel +
    totalTAGValue +
    data.arriendo +
    data.seguro +
    data.efectivoMonto;

  const subtotal = data.totalFacturado;

  // Descuentos extra (uno o varios, definidos solo para este cálculo; no se persisten)
  const descuentosExtra: DetalleDescuento[] = (data.descuentosExtra ?? [])
    .filter((d) => d.monto > 0)
    .map((d) => ({
      concepto: d.descripcion.trim() ? `Descuento extra - ${d.descripcion.trim()}` : "Descuento extra",
      monto: d.monto,
    }));

  const totalDescuentosExtra = (data.descuentosExtra ?? []).reduce(
    (sum, d) => sum + (Number.isFinite(d.monto) ? d.monto : 0),
    0
  );

  const descuentosSecundarios: DetalleDescuento[] = [
    { concepto: "Mantención", monto: data.mantencion },
    { concepto: "Anticipo", monto: data.anticipo },
    { concepto: "Préstamo", monto: data.prestamo },
    ...descuentosExtra,
  ];

  const totalDescuentosSecundarios =
    data.mantencion + data.anticipo + data.prestamo + totalDescuentosExtra;
  const totalDescuentos = totalDescuentosPrimarios + totalDescuentosSecundarios;
  const totalAPagar = subtotal - totalDescuentos;

  return {
    trabajadorId: data.trabajadorId,
    nombre: data.nombre,
    email: data.email,
    rut: data.rut,
    totalFacturado: data.totalFacturado,
    descuentosPrimarios,
    subtotal,
    descuentosSecundarios,
    totalDescuentos,
    totalAPagar,
  };
}
