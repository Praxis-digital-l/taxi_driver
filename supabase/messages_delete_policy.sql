-- Habilitar RLS si no lo está (idempotente)
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Eliminar política existente si hay (para poder re-ejecutar el script)
DROP POLICY IF EXISTS "Admins pueden eliminar mensajes" ON public.messages;

-- Crear política que permite a admins y super_admins eliminar cualquier mensaje
CREATE POLICY "Admins pueden eliminar mensajes" ON public.messages
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );
