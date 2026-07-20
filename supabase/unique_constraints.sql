-- Evitar RUT duplicados
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_rut_key,
  ADD CONSTRAINT profiles_rut_key UNIQUE (rut);

-- Evitar teléfono duplicado
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_phone_key,
  ADD CONSTRAINT profiles_phone_key UNIQUE (phone);
