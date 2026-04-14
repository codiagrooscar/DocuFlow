-- Ejecuta este script en el SQL Editor de tu proyecto de Supabase

-- 1. Crear tabla de usuarios
CREATE TABLE public.users (
  uid UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'sales'
);

-- 2. Crear tabla de expedientes (sales_processes)
CREATE TABLE public.sales_processes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  "clientName" TEXT NOT NULL,
  "currentStage" TEXT NOT NULL,
  "quoteStatus" TEXT,
  "proformaStatus" TEXT,
  "orderStatus" TEXT,
  "deliveryStatus" TEXT,
  "invoiceStatus" TEXT,
  "createdAt" BIGINT NOT NULL,
  "updatedAt" BIGINT NOT NULL,
  "createdBy" UUID REFERENCES public.users(uid),
  "pdfUrl" TEXT,
  "pdfName" TEXT,
  documents JSONB DEFAULT '[]'::jsonb,
  comments JSONB DEFAULT '[]'::jsonb,
  tasks JSONB DEFAULT '[]'::jsonb,
  tags JSONB DEFAULT '[]'::jsonb,
  "authRequests" JSONB DEFAULT '[]'::jsonb,
  "estimatedDeliveryDate" BIGINT,
  "validUntil" BIGINT,
  "trackingToken" TEXT
);

-- 3. Crear tabla de logs de actividad
CREATE TABLE public.activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "processId" UUID REFERENCES public.sales_processes(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  "performedBy" UUID REFERENCES public.users(uid),
  "performedByName" TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  details TEXT
);

-- 4. Habilitar Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- 5. Políticas para 'users'
CREATE POLICY "Users can view all users" ON public.users FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert their own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = uid);
CREATE POLICY "Users can update their own profile" ON public.users FOR UPDATE USING (auth.uid() = uid);

-- 6. Políticas para 'sales_processes'
CREATE POLICY "Authenticated users can view all processes" ON public.sales_processes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Public can view process with tracking token" ON public.sales_processes FOR SELECT USING ("trackingToken" IS NOT NULL);
CREATE POLICY "Authenticated users can insert processes" ON public.sales_processes FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = "createdBy");
CREATE POLICY "Authenticated users can update processes" ON public.sales_processes FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Only admins can delete processes" ON public.sales_processes FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE uid = auth.uid() AND role = 'admin')
);

-- 7. Políticas para 'activity_logs'
CREATE POLICY "Authenticated users can view logs" ON public.activity_logs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert logs" ON public.activity_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = "performedBy");

-- 8. Habilitar Realtime
alter publication supabase_realtime add table public.sales_processes;
alter publication supabase_realtime add table public.activity_logs;
