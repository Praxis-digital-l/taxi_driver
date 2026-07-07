
-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'conductor');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT DEFAULT '',
  role public.app_role NOT NULL DEFAULT 'conductor',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create vehicles table
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_plate TEXT NOT NULL UNIQUE,
  make TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  year INTEGER,
  color TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- Create vehicle_assignments
CREATE TABLE public.vehicle_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE NOT NULL,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(vehicle_id, profile_id)
);
ALTER TABLE public.vehicle_assignments ENABLE ROW LEVEL SECURITY;

-- Create document_types lookup
CREATE TABLE public.document_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE
);
ALTER TABLE public.document_types ENABLE ROW LEVEL SECURITY;

-- Seed document types
INSERT INTO public.document_types (name) VALUES
  ('Liquidación de sueldo'),
  ('Factura de taller'),
  ('Combustible'),
  ('TAG'),
  ('Permiso fuera de RM'),
  ('Seguro'),
  ('Compra de repuestos');

-- Create documents table
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  document_type_id UUID REFERENCES public.document_types(id) NOT NULL,
  file_url TEXT NOT NULL,
  file_key TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pendiente',
  expiration_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Create mileage_records table
CREATE TABLE public.mileage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE NOT NULL,
  kilometers INTEGER NOT NULL,
  recorded_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.mileage_records ENABLE ROW LEVEL SECURITY;

-- Create request_types lookup
CREATE TABLE public.request_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE
);
ALTER TABLE public.request_types ENABLE ROW LEVEL SECURITY;

-- Seed request types
INSERT INTO public.request_types (name) VALUES
  ('Préstamo'),
  ('Anticipo'),
  ('Combustible'),
  ('Repuestos'),
  ('Mantención');

-- Create requests table
CREATE TABLE public.requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  request_type_id UUID REFERENCES public.request_types(id) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendiente',
  details TEXT DEFAULT '',
  amount NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

-- Create admin_notes table
CREATE TABLE public.admin_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE NOT NULL,
  admin_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  note_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_notes ENABLE ROW LEVEL SECURITY;

-- Create messages table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendiente',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- HELPER FUNCTIONS (SECURITY DEFINER)
-- ==========================================

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_conductor(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id AND role = 'conductor'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_vehicle_access(_vehicle_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vehicle_assignments va
    JOIN public.profiles p ON p.id = va.profile_id
    WHERE va.vehicle_id = _vehicle_id AND p.user_id = _user_id
  );
$$;

-- ==========================================
-- RLS POLICIES
-- ==========================================

-- profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- vehicles
CREATE POLICY "Admins see all vehicles" ON public.vehicles FOR SELECT USING (public.is_admin(auth.uid()) OR public.has_vehicle_access(id, auth.uid()));
CREATE POLICY "Admins manage vehicles" ON public.vehicles FOR ALL USING (public.is_admin(auth.uid()));

-- vehicle_assignments
CREATE POLICY "View assignments" ON public.vehicle_assignments FOR SELECT USING (public.is_admin(auth.uid()) OR public.has_vehicle_access(vehicle_id, auth.uid()));
CREATE POLICY "Admin manages assignments" ON public.vehicle_assignments FOR ALL USING (public.is_admin(auth.uid()));

-- document_types (readable by all authenticated)
CREATE POLICY "Anyone can read doc types" ON public.document_types FOR SELECT TO authenticated USING (true);

-- documents
CREATE POLICY "View documents" ON public.documents FOR SELECT USING (
  public.is_admin(auth.uid()) OR
  profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Conductors insert documents" ON public.documents FOR INSERT WITH CHECK (
  profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Manage own documents" ON public.documents FOR UPDATE USING (
  public.is_admin(auth.uid()) OR
  profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Delete own documents" ON public.documents FOR DELETE USING (
  public.is_admin(auth.uid()) OR
  profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- mileage_records
CREATE POLICY "View mileage" ON public.mileage_records FOR SELECT USING (
  public.is_admin(auth.uid()) OR
  profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Insert mileage" ON public.mileage_records FOR INSERT WITH CHECK (
  profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Update mileage" ON public.mileage_records FOR UPDATE USING (
  profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- request_types
CREATE POLICY "Anyone can read req types" ON public.request_types FOR SELECT TO authenticated USING (true);

-- requests
CREATE POLICY "View requests" ON public.requests FOR SELECT USING (
  public.is_admin(auth.uid()) OR
  profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Conductors create requests" ON public.requests FOR INSERT WITH CHECK (
  profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Manage requests" ON public.requests FOR UPDATE USING (
  public.is_admin(auth.uid()) OR
  profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Delete requests" ON public.requests FOR DELETE USING (
  public.is_admin(auth.uid()) OR
  profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- admin_notes (admin only)
CREATE POLICY "Admin manages notes" ON public.admin_notes FOR ALL USING (public.is_admin(auth.uid()));

-- messages
CREATE POLICY "View own messages" ON public.messages FOR SELECT USING (
  sender_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR
  receiver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR
  public.is_admin(auth.uid())
);
CREATE POLICY "Send messages" ON public.messages FOR INSERT WITH CHECK (
  sender_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR
  public.is_admin(auth.uid())
);
CREATE POLICY "Update own messages" ON public.messages FOR UPDATE USING (
  sender_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR
  receiver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR
  public.is_admin(auth.uid())
);

-- ==========================================
-- UPDATED_AT TRIGGER
-- ==========================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_requests_updated_at BEFORE UPDATE ON public.requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_admin_notes_updated_at BEFORE UPDATE ON public.admin_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ==========================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'conductor')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- STORAGE BUCKET
-- ==========================================

INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);

CREATE POLICY "Users upload own docs" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "Users view own docs" ON storage.objects FOR SELECT USING (
  bucket_id = 'documents' AND (
    auth.uid()::text = (storage.foldername(name))[1] OR
    public.is_admin(auth.uid())
  )
);
CREATE POLICY "Users delete own docs" ON storage.objects FOR DELETE USING (
  bucket_id = 'documents' AND (
    auth.uid()::text = (storage.foldername(name))[1] OR
    public.is_admin(auth.uid())
  )
);
