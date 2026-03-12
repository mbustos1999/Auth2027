-- Solicitudes de acceso manual (comprobante cuando no hay suscripción MP)
-- Ejecutar en Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.access_requests (
  id BIGSERIAL PRIMARY KEY,
  user_email TEXT NOT NULL,
  discord_id TEXT,
  comprobante_data TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_access_requests_status ON public.access_requests (status);
CREATE INDEX IF NOT EXISTS idx_access_requests_user_email ON public.access_requests (user_email);

ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;
