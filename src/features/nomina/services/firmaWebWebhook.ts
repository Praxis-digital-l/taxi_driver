/**
 * Controlador de webhook de FirmaWeb (fragmento para un servidor Express).
 *
 * Este fragmento vive como referencia y NO se ejecuta en el bundle del cliente Vite.
 * Montarlo en un servidor Node/Express:
 *
 *   import express from "express";
 *   import { firmaWebWebhook } from "./firmaWebWebhook";
 *
 *   const app = express();
 *   app.post("/api/webhooks/firmaweb", express.json({ limit: "10mb" }), firmaWebWebhook);
 *
 * Estados de FirmaWeb:
 *   1 = documento firmado
 *   2 = documento rechazado
 *
 * En producción conviene proteger el endpoint con un token secreto compartido
 * (p. ej. header "X-Webhook-Token") antes de procesar el payload.
 *
 * Al recibir un estado conocido, actualizar la fila de la liquidación
 * (Supabase, con service role) cruzando por firma_id_documento:
 *
 *   UPDATE public.liquidaciones
 *   SET firma_estado = 1   -- 1 = firmada, 2 = rechazada
 *   WHERE firma_id_documento = '123';
 */

export type FirmaWebWebhookPayload = {
  IdDocumento?: string;
  IdProceso?: string;
  IdGrupo?: string;
  estado?: number | string;
} & Record<string, unknown>;

type WebhookRespuesta = {
  status(codigo: number): { json(datos: unknown): void };
};

export const ESTADO_FIRMADO = 1;
export const ESTADO_RECHAZADO = 2;

export async function firmaWebWebhook(
  req: { body?: unknown },
  res: WebhookRespuesta,
): Promise<void> {
  const payload = (req.body ?? {}) as FirmaWebWebhookPayload;
  const estado = Number(payload.estado ?? payload.Estado ?? "nan");
  const idDocumento = String(payload.IdDocumento ?? "");
  const idProceso = String(payload.IdProceso ?? "");

  if (estado === ESTADO_FIRMADO) {
    console.log(`[FirmaWeb] Documento firmado. IdDocumento=${idDocumento} IdProceso=${idProceso}`);
  } else if (estado === ESTADO_RECHAZADO) {
    console.warn(`[FirmaWeb] Documento rechazado. IdDocumento=${idDocumento} IdProceso=${idProceso}`);
  } else {
    console.warn(`[FirmaWeb] Estado no reconocido recibido: "${estado}"`);
  }

  res.status(200).json({ ok: true });
}