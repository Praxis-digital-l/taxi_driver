-- 1. Eliminar el check constraint viejo que solo permitía pendiente/en_proceso/completado
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_status_check;

-- 2. Crear el nuevo constraint con los estados actualizados
ALTER TABLE public.messages ADD CONSTRAINT messages_status_check
  CHECK (status IN ('pendiente', 'en_proceso', 'completado', 'enviado', 'visto'));

-- 3. Función que permite al conductor marcar como visto (bypass RLS con SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.mark_message_read(msg_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.messages SET status = 'visto' WHERE id = msg_id;
END;
$$;

-- 4. Dar permiso de ejecución a usuarios autenticados
GRANT EXECUTE ON FUNCTION public.mark_message_read TO authenticated;
