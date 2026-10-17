-- ============================================================================
-- Beneficios por puntaje para solicitudes de conductores.
--
-- Regla: un tipo de solicitud con `min_score > 0` es un "beneficio" y solo se
-- muestra / se puede solicitar cuando el conductor tiene al menos ese puntaje
-- de estrellas. Con 8+ estrellas se habilitan:
--   - Préstamos
--   - Auto de reemplazo
--   - Postergar recargo de arriendo
--   - Uso de auto en vacaciones
-- Con 7 estrellas o menos la lista de beneficios no aparece.
-- ============================================================================

-- 1) Nueva columna: puntaje mínimo requerido para solicitar el tipo.
ALTER TABLE public.request_types
  ADD COLUMN IF NOT EXISTS min_score integer NOT NULL DEFAULT 0;

-- 2) Alta de los tipos de beneficio (idempotente: compara sin acentos/mayúsculas).
INSERT INTO public.request_types (name, min_score)
SELECT v.name, 8
FROM (VALUES
  ('Préstamos'),
  ('Auto de reemplazo'),
  ('Postergar recargo de arriendo'),
  ('Uso de auto en vacaciones')
) AS v(name)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.request_types rt
  WHERE lower(translate(rt.name, 'áéíóúüÁÉÍÓÚÜ', 'aeiouuAEIOUU')) =
        lower(translate(v.name, 'áéíóúüÁÉÍÓÚÜ', 'aeiouuAEIOUU'))
);

-- 3) Si algún beneficio ya existía (por ejemplo "Préstamo" en singular),
--    solo se le asigna el puntaje mínimo sin duplicarlo.
UPDATE public.request_types
SET min_score = 8
WHERE lower(translate(name, 'áéíóúüÁÉÍÓÚÜ', 'aeiouuAEIOUU')) IN (
  'prestamo',
  'prestamos',
  'auto de reemplazo',
  'postergar recargo de arriendo',
  'uso de auto en vacaciones'
);

-- 4) Refuerzo a nivel de base de datos: un conductor no puede crear ni cambiar
--    una solicitud a un tipo de beneficio si no cumple el puntaje mínimo.
--    Los administradores y el backend (service role) no quedan restringidos.
CREATE OR REPLACE FUNCTION public.enforce_request_min_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  required_score integer;
  conductor_score integer;
  caller_role text;
BEGIN
  -- Sin sesión de usuario (service role / SQL editor): permitir.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Los administradores pueden gestionar cualquier solicitud.
  SELECT p.role::text INTO caller_role
  FROM public.profiles p
  WHERE p.user_id = auth.uid();

  IF caller_role = 'admin' THEN
    RETURN NEW;
  END IF;

  SELECT rt.min_score INTO required_score
  FROM public.request_types rt
  WHERE rt.id = NEW.request_type_id;

  IF COALESCE(required_score, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(p.score, 0) INTO conductor_score
  FROM public.profiles p
  WHERE p.id = NEW.profile_id;

  IF COALESCE(conductor_score, 0) < required_score THEN
    RAISE EXCEPTION
      'Necesitas al menos % estrellas para solicitar este beneficio.', required_score
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_request_min_score ON public.requests;
CREATE TRIGGER trg_enforce_request_min_score
  BEFORE INSERT OR UPDATE OF request_type_id ON public.requests
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_request_min_score();
