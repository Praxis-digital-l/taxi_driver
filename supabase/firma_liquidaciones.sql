ALTER TABLE public.liquidaciones
  ADD COLUMN IF NOT EXISTS firma_url text,
  ADD COLUMN IF NOT EXISTS firma_estado smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS firma_id_documento text,
  ADD COLUMN IF NOT EXISTS firma_id_proceso text;