
-- Add missing document types
INSERT INTO public.document_types (name) VALUES
  ('Seguro comercial'),
  ('Seguro de asiento'),
  ('Boleta combustible')
ON CONFLICT (name) DO NOTHING;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_documents_expiration ON public.documents (expiration_date) WHERE expiration_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_profile ON public.documents (profile_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON public.requests (status);
CREATE INDEX IF NOT EXISTS idx_requests_profile ON public.requests (profile_id);
CREATE INDEX IF NOT EXISTS idx_mileage_vehicle ON public.mileage_records (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON public.messages (receiver_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON public.vehicles (license_plate);
