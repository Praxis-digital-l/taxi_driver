-- ============================================================================
-- Configuración global del recargo de préstamos
-- ============================================================================
-- Permite que /admin/requests cambie el porcentaje (0-100) y que el trigger
-- de solicitudes use siempre el valor vigente guardado en la base de datos.

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value numeric NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.app_settings (key, value)
VALUES ('prestamo_recargo_porcentaje', 20)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
-- Sin políticas: el acceso pasa exclusivamente por las funciones SECURITY DEFINER.

CREATE OR REPLACE FUNCTION public.get_prestamo_recargo_porcentaje()
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT s.value FROM public.app_settings s WHERE s.key = 'prestamo_recargo_porcentaje'),
    20
  );
$$;

REVOKE ALL ON FUNCTION public.get_prestamo_recargo_porcentaje() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_prestamo_recargo_porcentaje() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_prestamo_recargo_porcentaje(p_porcentaje numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Solo un administrador puede cambiar el porcentaje de recargo de préstamos.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_porcentaje IS NULL OR p_porcentaje < 0 OR p_porcentaje > 100 THEN
    RAISE EXCEPTION 'El porcentaje debe estar entre 0 y 100.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_porcentaje <> trunc(p_porcentaje) THEN
    RAISE EXCEPTION 'El porcentaje debe ser un número entero.'
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.app_settings (key, value, updated_at)
  VALUES ('prestamo_recargo_porcentaje', p_porcentaje, now())
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        updated_at = now();

  RETURN p_porcentaje;
END;
$$;

REVOKE ALL ON FUNCTION public.set_prestamo_recargo_porcentaje(numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_prestamo_recargo_porcentaje(numeric) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Trigger de validación de préstamos: usa el porcentaje configurado.
-- ----------------------------------------------------------------------------
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

  -- Obtener nombre del tipo de solicitud
  SELECT rt.name INTO v_req_type_name
  FROM public.request_types rt
  WHERE rt.id = NEW.request_type_id;

  v_normalized_type := lower(translate(COALESCE(v_req_type_name, ''), 'áéíóúüÁÉÍÓÚÜ', 'aeiouuAEIOUU'));

  -- Solo aplicar reglas de préstamo si el tipo es préstamo / préstamos
  IF v_normalized_type NOT LIKE '%prestamo%' THEN
    RETURN NEW;
  END IF;

  -- Calcular el recargo con el porcentaje vigente (también para admins,
  -- para que una edición del monto no deje el total desactualizado).
  NEW.recargo_porcentaje := LEAST(100, GREATEST(0, public.get_prestamo_recargo_porcentaje()));
  IF NEW.amount IS NOT NULL THEN
    NEW.total_con_recargo := ROUND(NEW.amount * (1 + NEW.recargo_porcentaje / 100));
  END IF;

  -- Administradores pueden gestionar solicitudes sin restricción de conductor
  SELECT p.role::text INTO v_caller_role
  FROM public.profiles p
  WHERE p.user_id = auth.uid();

  IF v_caller_role = 'admin' THEN
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_loan_request_rules ON public.requests;
CREATE TRIGGER trg_enforce_loan_request_rules
  BEFORE INSERT OR UPDATE OF request_type_id, amount, cuotas, es_solicitud_especial ON public.requests
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_loan_request_rules();
