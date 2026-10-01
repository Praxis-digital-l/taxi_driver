-- Eliminar columna no utilizada firma_url_empleado ya que los conductores no firman, solo visualizan
ALTER TABLE public.liquidaciones
DROP COLUMN IF EXISTS firma_url_empleado;
