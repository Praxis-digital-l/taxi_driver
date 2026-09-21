/**
 * Servicio generador de Liquidaciones de Nómina en PDF
 * Utiliza jsPDF para maquetar el documento oficial de Transportes El Montañez
 * y calcular las coordenadas exactas de las firmas electrónicas.
 */

import jsPDF from "jspdf";
import { LOGO_APP_BASE64 } from "@/features/nomina/components/logoBase64";
import {
  DatosLiquidacionNomina,
  ResultadoGeneracionPdf,
  UbicacionesFirmaLiquidacion,
} from "../types/firmaweb.types";

export interface IPdfGeneratorService {
  generarPdfLiquidacion(datos: DatosLiquidacionNomina): Promise<ResultadoGeneracionPdf>;
}

export class PdfLiquidacionService implements IPdfGeneratorService {
  private readonly monedaFormatter = new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });

  /**
   * Genera el PDF formal de liquidación de nómina y entrega el Base64
   * junto con las coordenadas precisas donde FirmaWeb estampará las rúbricas.
   */
  public async generarPdfLiquidacion(
    datos: DatosLiquidacionNomina
  ): Promise<ResultadoGeneracionPdf> {
    // A4: 210mm x 297mm
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const margenX = 20;
    let cursorY = 25;

    // -------------------------------------------------------------
    // 1. ENCABEZADO OFICIAL OSCURO (Full-width Navy)
    // -------------------------------------------------------------
    doc.setFillColor(14, 19, 31); // #0e131f
    doc.rect(0, 0, 210, 34, "F");

    // Ícono oficial de la aplicación (Modo Claro)
    try {
      doc.addImage(LOGO_APP_BASE64, "PNG", 16, 9, 15, 15);
    } catch {
      doc.setFillColor(245, 158, 11);
      doc.roundedRect(16, 9, 15, 15, 3, 3, "F");
    }

    // Título y Subtítulo
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text("TRANSPORTES EL MONTAÑEZ", 36, 17);

    doc.setFontSize(8);
    doc.setTextColor(251, 191, 36); // #fbbf24
    doc.text("LIQUIDACIÓN DE NÓMINA", 36, 22);

    // Lado derecho del encabezado
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(251, 191, 36);
    doc.text("DOCUMENTO OFICIAL", 195, 13, { align: "right" });

    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(datos.periodoMes, 195, 20, { align: "right" });

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(`Emitido el ${datos.fechaEmision}`, 195, 26, { align: "right" });

    // -------------------------------------------------------------
    // 2. DATOS DEL TRABAJADOR (Tarjeta 4 Columnas)
    // -------------------------------------------------------------
    cursorY = 41;
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.3);
    doc.roundedRect(15, cursorY, 180, 16, 2, 2, "FD");

    const posYEtiquetas = cursorY + 5;
    const posYValores = cursorY + 11;

    // Columna 1: TRABAJADOR
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(148, 163, 184);
    doc.text("TRABAJADOR", 20, posYEtiquetas);
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    const nombreCompleto = `${datos.empleado.nombre} ${datos.empleado.apellidoPaterno} ${datos.empleado.apellidoMaterno ?? ""}`.trim();
    doc.text(nombreCompleto.length > 22 ? nombreCompleto.substring(0, 20) + "..." : nombreCompleto, 20, posYValores);

    // Columna 2: ID DE TRABAJADOR
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text("ID DE TRABAJADOR", 70, posYEtiquetas);
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(datos.empleado.trabajadorId, 70, posYValores);

    // Columna 3: RUT
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text("RUT", 110, posYEtiquetas);
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(datos.empleado.rut, 110, posYValores);

    // Columna 4: CORREO
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text("CORREO", 145, posYEtiquetas);
    const emailStr = datos.empleado.email || "No registrado";
    doc.setFontSize(emailStr.length > 26 ? 6.5 : 8);
    doc.setTextColor(15, 23, 42);
    doc.text(emailStr, 145, posYValores);

    // -------------------------------------------------------------
    // 3. SECCIÓN INGRESOS
    // -------------------------------------------------------------
    cursorY += 21;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(15, cursorY, 180, 18, 2, 2, "FD");

    // Barra superior Ingresos
    doc.setFillColor(254, 249, 238); // amber-50
    doc.roundedRect(15, cursorY, 180, 6.5, 2, 2, "F");
    // Pill ámbar
    doc.setFillColor(245, 158, 11);
    doc.rect(18, cursorY + 1.5, 1.2, 3.5, "F");
    // Texto INGRESOS
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(180, 83, 9); // amber-700
    doc.text("INGRESOS", 22, cursorY + 4.5);

    // Fila Total Facturado
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    doc.text("Total facturado", 20, cursorY + 13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(this.monedaFormatter.format(datos.totalFacturado), 190, cursorY + 13, { align: "right" });

    // -------------------------------------------------------------
    // 4. SECCIÓN DESCUENTOS
    // -------------------------------------------------------------
    cursorY += 23;
    const altoDescuentos = Math.max(25, 14 + (datos.descuentosPrimarios.length + (datos.descuentosSecundarios?.length || 0)) * 5);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(15, cursorY, 180, altoDescuentos, 2, 2, "FD");

    // Barra superior Descuentos
    doc.setFillColor(248, 250, 252); // slate-50
    doc.roundedRect(15, cursorY, 180, 6.5, 2, 2, "F");
    // Pill ámbar
    doc.setFillColor(245, 158, 11);
    doc.rect(18, cursorY + 1.5, 1.2, 3.5, "F");
    // Texto DESCUENTOS
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(71, 85, 105);
    doc.text("DESCUENTOS", 22, cursorY + 4.5);

    let filY = cursorY + 12;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    for (const desc of datos.descuentosPrimarios) {
      doc.setTextColor(71, 85, 105);
      doc.text(desc.concepto, 20, filY);
      doc.setTextColor(239, 68, 68); // rose-500 red
      doc.text(`$-${Math.abs(desc.monto).toLocaleString("es-CL")}`, 190, filY, { align: "right" });
      filY += 5;
    }

    if (datos.descuentosSecundarios && datos.descuentosSecundarios.length > 0) {
      doc.setDrawColor(203, 213, 225);
      doc.setLineDashPattern([1, 1], 0);
      doc.line(20, filY - 1, 190, filY - 1);
      doc.setLineDashPattern([], 0);
      filY += 3;

      for (const desc of datos.descuentosSecundarios) {
        doc.setTextColor(71, 85, 105);
        doc.text(desc.concepto, 20, filY);
        doc.setTextColor(239, 68, 68);
        doc.text(`$-${Math.abs(desc.monto).toLocaleString("es-CL")}`, 190, filY, { align: "right" });
        filY += 5;
      }
    }

    // -------------------------------------------------------------
    // 5. TARJETA TOTALES OSCURA
    // -------------------------------------------------------------
    cursorY += altoDescuentos + 6;
    doc.setFillColor(14, 19, 31); // #0e131f
    doc.roundedRect(15, cursorY, 180, 30, 3, 3, "F");

    // Subtotal
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text("Subtotal", 22, cursorY + 7);
    doc.setTextColor(226, 232, 240);
    const subtotal = datos.totalFacturado;
    doc.text(`$${subtotal.toLocaleString("es-CL")}`, 188, cursorY + 7, { align: "right" });

    // Total Descuentos
    doc.setTextColor(148, 163, 184);
    doc.text("Total descuentos", 22, cursorY + 12);
    doc.setTextColor(248, 113, 113); // red-400
    doc.text(`-$${datos.totalDescuentos.toLocaleString("es-CL")}`, 188, cursorY + 12, { align: "right" });

    // Línea divisoria
    doc.setDrawColor(51, 65, 85);
    doc.line(22, cursorY + 15, 188, cursorY + 15);

    // TOTAL A PAGAR
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(251, 191, 36); // amber-400
    doc.text("TOTAL A PAGAR", 22, cursorY + 23);

    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    const totalPagarStr = datos.totalAPagar < 0
      ? `$-${Math.abs(datos.totalAPagar).toLocaleString("es-CL")}`
      : `$${datos.totalAPagar.toLocaleString("es-CL")}`;
    doc.text(totalPagarStr, 188, cursorY + 24, { align: "right" });

    // -------------------------------------------------------------
    // 6. ESPACIO DE FIRMAS DIGITALES AL PIE DE PÁGINA
    // -------------------------------------------------------------
    const yFirmas = 220; // mm desde la parte superior (en página A4 de 297mm)
    const anchoFirma = 65;
    const altoFirma = 30;

    const xEmpleador = 25;
    const xEmpleado = 120;

    // Pie de página de validez formal
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(71, 85, 105);
    doc.text("TRANSPORTES EL MONTAÑEZ", 15, 278);

    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text(`RUT ${datos.empleador.rut} · Documento generado electrónicamente`, 15, 282);
    doc.text("Si tiene dudas sobre esta liquidación, contacte a administración.", 15, 286);

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(71, 85, 105);
    doc.text(nombreCompleto, 195, 278, { align: "right" });

    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text(`${datos.periodoMes} · ${datos.fechaEmision}`, 195, 282, { align: "right" });

    // -------------------------------------------------------------
    // 5. EXPORTACIÓN A BASE64 Y RETORNO DE POSICIONES
    // -------------------------------------------------------------
    // Obtener data URI y extraer solo la parte Base64 limpia
    const dataUri = doc.output("datauristring");
    const base64 = dataUri.split(",")[1] || "";

    const posicionesFirma: UbicacionesFirmaLiquidacion = {
      empleador: {
        pagina: 1,
        x: xEmpleador,
        y: yFirmas,
        ancho: anchoFirma,
        alto: altoFirma,
      },
      empleado: {
        pagina: 1,
        x: xEmpleado,
        y: yFirmas,
        ancho: anchoFirma,
        alto: altoFirma,
      },
    };

    const idDoc = datos.idLiquidacion || datos.empleado.trabajadorId;
    const nombreArchivo = `Liquidacion_${idDoc}_${datos.periodoMes.replace(/\s+/g, "_")}.pdf`;

    return {
      base64,
      nombreArchivo,
      totalPaginas: 1,
      posicionesFirma,
    };
  }
}

