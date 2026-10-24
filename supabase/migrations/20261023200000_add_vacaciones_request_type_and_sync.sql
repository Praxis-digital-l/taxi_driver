-- ============================================================================
-- Migración: Agregar tipo de solicitud 'Vacaciones' (min_score = 0)
-- y sincronizar solicitudes de vacaciones existentes a la tabla 'requests'.
-- ============================================================================

-- 1. Insertar el tipo oficial 'Vacaciones' con min_score = 0 (accesible a cualquier conductor)
INSERT INTO public.request_types (name, min_score)
SELECT 'Vacaciones', 0
WHERE NOT EXISTS (
  SELECT 1 FROM public.request_types WHERE lower(translate(name, 'áéíóúüÁÉÍÓÚÜ', 'aeiouuAEIOUU')) = 'vacaciones'
);

-- 2. Asegurar que min_score sea 0 para Vacaciones
UPDATE public.request_types
SET min_score = 0
WHERE lower(translate(name, 'áéíóúüÁÉÍÓÚÜ', 'aeiouuAEIOUU')) = 'vacaciones';

-- 3. Migrar / sincronizar registros de 'conductor_vacations' que no tengan su fila en 'requests'
DO $$
DECLARE
  v_vac_type_id UUID;
  v_rec RECORD;
BEGIN
  SELECT id INTO v_vac_type_id
  FROM public.request_types
  WHERE lower(translate(name, 'áéíóúüÁÉÍÓÚÜ', 'aeiouuAEIOUU')) = 'vacaciones'
  LIMIT 1;

  IF v_vac_type_id IS NOT NULL THEN
    FOR v_rec IN
      SELECT
        cv.id,
        cv.profile_id,
        cv.vehicle_id,
        cv.start_date,
        cv.end_date,
        cv.days_count,
        cv.status,
        cv.notes,
        cv.created_at
      FROM public.conductor_vacations cv
      WHERE cv.status IN ('pendiente', 'programada', 'en_curso')
        AND NOT EXISTS (
          SELECT 1 FROM public.requests r
          WHERE r.profile_id = cv.profile_id
            AND (
              r.details LIKE '%Salida: ' || cv.start_date || '%'
              OR r.details LIKE '%' || cv.start_date || '%'
            )
            AND (
              r.details LIKE '%Retorno: ' || cv.end_date || '%'
              OR r.details LIKE '%' || cv.end_date || '%'
            )
        )
    LOOP
      INSERT INTO public.requests (
        profile_id,
        request_type_id,
        vehicle_id,
        status,
        details,
        created_at
      ) VALUES (
        v_rec.profile_id,
        v_vac_type_id,
        v_rec.vehicle_id,
        CASE
          WHEN v_rec.notes LIKE '%[STATUS:pendiente]%' OR v_rec.notes LIKE '%[estado_solicitud:pendiente]%' OR v_rec.status = 'pendiente' THEN 'pendiente'
          WHEN v_rec.status IN ('programada', 'en_curso') THEN 'aprobado'
          ELSE 'pendiente'
        END,
        '[SOLICITUD DE VACACIONES Y POSTERGACIÓN DE ARRIENDO] Salida: ' || v_rec.start_date || ' · Retorno: ' || v_rec.end_date || ' (' || v_rec.days_count || ' días). Se solicita postergación de pago de arriendo con recargo del 10% al retorno.',
        v_rec.created_at
      );
    END LOOP;
  END IF;
END $$;

