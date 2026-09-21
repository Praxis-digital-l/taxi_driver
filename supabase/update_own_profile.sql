CREATE OR REPLACE FUNCTION public.update_own_profile(
  p_nombres TEXT,
  p_apellido_paterno TEXT,
  p_apellido_materno TEXT,
  p_rut TEXT,
  p_phone TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.profiles
  SET nombres = p_nombres,
      apellido_paterno = p_apellido_paterno,
      apellido_materno = p_apellido_materno,
      rut = p_rut,
      phone = NULLIF(p_phone, ''),
      full_name = TRIM(p_nombres || ' ' || p_apellido_paterno || ' ' || p_apellido_materno),
      updated_at = now()
  WHERE user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_own_profile(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;