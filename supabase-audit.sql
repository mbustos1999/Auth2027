-- Tabla de auditoría para accesos sensibles
-- Ejecutar en Supabase SQL Editor (opcional).

CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  table_name TEXT,
  record_id BIGINT,
  actor_email TEXT,
  ip_address TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_audit_created_at ON public.security_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_event ON public.security_audit_log (event_type);

ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Solo service_role puede insertar/leer (el bot usa service_role)
CREATE POLICY "security_audit_service_only" ON public.security_audit_log
  FOR ALL USING (false);

-- Nota: el bot puede insertar registros manualmente vía Supabase cuando detecte
-- eventos de seguridad (ej. auth fallida). La tabla queda lista para uso futuro.
