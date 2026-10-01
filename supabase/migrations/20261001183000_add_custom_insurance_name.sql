
-- Agregar columna para nombre personalizado de seguro cuando el tipo sea 'otro'
ALTER TABLE public.vehicle_insurances
ADD COLUMN IF NOT EXISTS custom_insurance_name text;
