-- ============================================================================
-- Repuestos comprados directamente por el administrador
-- ============================================================================
-- Guarda solo el monto total por vehículo y período. Complementa (no
-- reemplaza) los repuestos registrados como documentos del vehículo.

CREATE TABLE IF NOT EXISTS public.vehicle_manual_repuestos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  monto numeric NOT NULL DEFAULT 0 CHECK (monto >= 0),
  anio_rendimiento integer NOT NULL,
  mes_rendimiento integer NOT NULL CHECK (mes_rendimiento BETWEEN 1 AND 12),
  fecha_registro date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vehicle_id, anio_rendimiento, mes_rendimiento)
);

ALTER TABLE public.vehicle_manual_repuestos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view manual repuestos" ON public.vehicle_manual_repuestos;
CREATE POLICY "Admins can view manual repuestos"
  ON public.vehicle_manual_repuestos
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can insert manual repuestos" ON public.vehicle_manual_repuestos;
CREATE POLICY "Admins can insert manual repuestos"
  ON public.vehicle_manual_repuestos
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update manual repuestos" ON public.vehicle_manual_repuestos;
CREATE POLICY "Admins can update manual repuestos"
  ON public.vehicle_manual_repuestos
  FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete manual repuestos" ON public.vehicle_manual_repuestos;
CREATE POLICY "Admins can delete manual repuestos"
  ON public.vehicle_manual_repuestos
  FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));
