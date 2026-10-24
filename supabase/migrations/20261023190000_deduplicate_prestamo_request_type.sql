-- ============================================================================
-- Migración: Unificar tipos de solicitud duplicados ('Prestamo' y 'Préstamos')
-- ============================================================================

DO $$
DECLARE
  v_canonical_id UUID;
  v_duplicate_id UUID;
BEGIN
  -- Seleccionar el ID canónico preferido
  SELECT id INTO v_canonical_id
  FROM public.request_types
  WHERE lower(translate(name, 'áéíóúüÁÉÍÓÚÜ', 'aeiouuAEIOUU')) = 'prestamos'
     OR lower(translate(name, 'áéíóúüÁÉÍÓÚÜ', 'aeiouuAEIOUU')) = 'prestamo'
  ORDER BY (name = 'Préstamo') DESC, (name = 'Préstamos') DESC
  LIMIT 1;

  -- Si existe un duplicado con otro ID
  FOR v_duplicate_id IN
    SELECT id
    FROM public.request_types
    WHERE (lower(translate(name, 'áéíóúüÁÉÍÓÚÜ', 'aeiouuAEIOUU')) = 'prestamo'
       OR lower(translate(name, 'áéíóúüÁÉÍÓÚÜ', 'aeiouuAEIOUU')) = 'prestamos')
      AND id <> v_canonical_id
  LOOP
    -- Reasignar cualquier solicitud que apunte al duplicado
    UPDATE public.requests
    SET request_type_id = v_canonical_id
    WHERE request_type_id = v_duplicate_id;

    -- Eliminar el tipo duplicado
    DELETE FROM public.request_types
    WHERE id = v_duplicate_id;
  END LOOP;

  -- Asegurar el nombre con tilde y min_score = 8 en el canónico
  IF v_canonical_id IS NOT NULL THEN
    UPDATE public.request_types
    SET name = 'Préstamo',
        min_score = 8
    WHERE id = v_canonical_id;
  END IF;
END $$;

