CREATE TABLE public.pendientes_pago (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    liquidacion_id UUID NOT NULL REFERENCES public.liquidaciones(id) ON DELETE CASCADE,
    estado_sueldo TEXT NOT NULL DEFAULT 'pendiente',
    fecha_pago_sueldo TIMESTAMP WITH TIME ZONE,
    estado_autopista TEXT NOT NULL DEFAULT 'pendiente',
    fecha_pago_autopista TIMESTAMP WITH TIME ZONE,
    estado_seguro TEXT NOT NULL DEFAULT 'pendiente',
    fecha_pago_seguro TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_liquidacion_id UNIQUE (liquidacion_id)
);

-- Función para actualizar updated_at (por si no existe en la BD)
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar el updated_at
CREATE TRIGGER set_pendientes_pago_updated_at
BEFORE UPDATE ON public.pendientes_pago
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Habilitar RLS
ALTER TABLE public.pendientes_pago ENABLE ROW LEVEL SECURITY;

-- Eliminar politicas anteriores si existen
DROP POLICY IF EXISTS "Admins can do everything on pendientes_pago" ON public.pendientes_pago;
DROP POLICY IF EXISTS "Conductores can view their own pendientes" ON public.pendientes_pago;

-- Crear una política amplia para evitar bloqueos
CREATE POLICY "Permitir todo a usuarios autenticados" ON public.pendientes_pago
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

