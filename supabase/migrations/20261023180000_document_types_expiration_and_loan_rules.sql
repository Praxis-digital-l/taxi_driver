-- ============================================================================
-- Migración: Reglas de Documentos (Fecha de Vencimiento) y Préstamos
-- ============================================================================

-- 1. Document Types: Columna para indicar si requiere fecha de vencimiento
ALTER TABLE public.document_types
  ADD COLUMN IF NOT EXISTS requires_expiration boolean NOT NULL DEFAULT false;

-- 2. Asegurar e insertar los 5 tipos oficiales si no existen
INSERT INTO public.document_types (name, requires_expiration)
SELECT v.name, true
FROM (VALUES
  ('Revisión Técnica'),
  ('Permiso de Circulación'),
  ('SOAP'),
  ('Permiso de Asiento'),
  ('Seguro Conductor')
) AS v(name)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.document_types dt
  WHERE lower(translate(dt.name, 'áéíóúüÁÉÍÓÚÜ', 'aeiouuAEIOUU')) =
        lower(translate(v.name, 'áéíóúüÁÉÍÓÚÜ', 'aeiouuAEIOUU'))
);

-- 3. Marcar como requires_expiration = true a los 5 tipos oficiales
UPDATE public.document_types
SET requires_expiration = true
WHERE lower(translate(name, 'áéíóúüÁÉÍÓÚÜ', 'aeiouuAEIOUU')) IN (
  'revision tecnica',
  'permiso de circulacion',
  'soap',
  'permiso de asiento',
  'seguro conductor'
);

-- 4. Extender tabla requests para almacenar cuotas y recargos de préstamos
ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS cuotas integer CHECK (cuotas IS NULL OR (cuotas >= 1 AND cuotas <= 6)),
  ADD COLUMN IF NOT EXISTS recargo_porcentaje numeric DEFAULT 20,
  ADD COLUMN IF NOT EXISTS total_con_recargo numeric,
  ADD COLUMN IF NOT EXISTS es_solicitud_especial boolean DEFAULT false;

-- 5. Trigger de validación en requests para Préstamos
CREATE OR REPLACE FUNCTION public.enforce_loan_request_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req_type_name text;
  v_conductor_score integer;
  v_conductor_estado text;
  v_caller_role text;
  v_active_loans_count integer;
  v_normalized_type text;
BEGIN
  -- Sin sesión de usuario (ej. service role): omitir
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Administradores pueden gestionar solicitudes sin restricción de conductor
  SELECT p.role::text INTO v_caller_role
  FROM public.profiles p
  WHERE p.user_id = auth.uid();

  IF v_caller_role = 'admin' THEN
    RETURN NEW;
  END IF;

  -- Obtener nombre del tipo de solicitud
  SELECT rt.name INTO v_req_type_name
  FROM public.request_types rt
  WHERE rt.id = NEW.request_type_id;

  v_normalized_type := lower(translate(COALESCE(v_req_type_name, ''), 'áéíóúüÁÉÍÓÚÜ', 'aeiouuAEIOUU'));

  -- Solo aplicar validaciones de préstamo si el tipo es préstamo / préstamos
  IF v_normalized_type NOT LIKE '%prestamo%' THEN
    RETURN NEW;
  END IF;

  -- 1) Obtener datos del conductor
  SELECT COALESCE(p.score, 0), COALESCE(p.estado_conductor, 'nuevo')
  INTO v_conductor_score, v_conductor_estado
  FROM public.profiles p
  WHERE p.id = NEW.profile_id;

  -- 2) Requisito indispensable: 8 o más estrellas
  IF v_conductor_score < 8 THEN
    RAISE EXCEPTION 'Solo pueden solicitar un préstamo conductores con 8 o más estrellas. Tu puntuación actual es de % estrellas.', v_conductor_score
      USING ERRCODE = 'check_violation';
  END IF;

  -- 3) Si es una nueva solicitud (INSERT), verificar que no tenga préstamos activos
  IF TG_OP = 'INSERT' THEN
    SELECT COUNT(*)
    INTO v_active_loans_count
    FROM public.requests r
    JOIN public.request_types rt ON rt.id = r.request_type_id
    WHERE r.profile_id = NEW.profile_id
      AND lower(translate(rt.name, 'áéíóúüÁÉÍÓÚÜ', 'aeiouuAEIOUU')) LIKE '%prestamo%'
      AND r.status IN ('pendiente', 'en_proceso', 'aprobado');

    IF v_active_loans_count > 0 THEN
      RAISE EXCEPTION 'No puedes solicitar un préstamo si existen cuotas pendientes o un préstamo en curso.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- 4) Validación de cuotas (hasta 6 cuotas máximo)
  IF NEW.cuotas IS NOT NULL AND (NEW.cuotas < 1 OR NEW.cuotas > 6) THEN
    RAISE EXCEPTION 'Los préstamos pueden ser hasta en 6 cuotas máximo.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- 5) Validación de montos según antigüedad
  IF NEW.amount IS NOT NULL THEN
    IF NEW.amount < 100000 THEN
      RAISE EXCEPTION 'El monto mínimo para solicitar un préstamo es de $100.000.'
        USING ERRCODE = 'check_violation';
    END IF;

    -- Conductor Nuevo: $100.000 hasta $300.000
    IF v_conductor_estado = 'nuevo' AND NEW.amount > 300000 THEN
      RAISE EXCEPTION 'Para conductores nuevos el monto máximo de préstamo es de $300.000.'
        USING ERRCODE = 'check_violation';
    END IF;

    -- Conductor Antiguo: hasta $500.000 estándar, o hasta $1.000.000 en solicitud especial
    IF v_conductor_estado = 'antiguo' THEN
      IF NEW.amount > 500000 AND COALESCE(NEW.es_solicitud_especial, false) = false THEN
        RAISE EXCEPTION 'Los préstamos de más de $500.000 hasta $1.000.000 deben registrarse como Solicitud Especial.'
          USING ERRCODE = 'check_violation';
      END IF;

      IF NEW.amount > 1000000 THEN
        RAISE EXCEPTION 'El monto máximo para solicitud especial es de $1.000.000.'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;

  -- 6) Calcular o asegurar el total con recargo del 20%
  NEW.recargo_porcentaje := 20;
  IF NEW.amount IS NOT NULL THEN
    NEW.total_con_recargo := ROUND(NEW.amount * 1.20);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_loan_request_rules ON public.requests;
CREATE TRIGGER trg_enforce_loan_request_rules
  BEFORE INSERT OR UPDATE OF request_type_id, amount, cuotas, es_solicitud_especial ON public.requests
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_loan_request_rules();

