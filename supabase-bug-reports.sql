-- Reportes de bugs/problemas de usuarios
-- Ejecutar en Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.bug_reports (
  id BIGSERIAL PRIMARY KEY,
  user_email TEXT NOT NULL,
  discord_id TEXT,
  discord_username TEXT,
  equipo TEXT NOT NULL,
  temporada INTEGER NOT NULL CHECK (temporada >= 2026 AND temporada <= 2034),
  problema TEXT NOT NULL,
  career_file_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'en_curso', 'resolved')),
  admin_nota TEXT,
  admin_respuesta TEXT,
  en_curso_at TIMESTAMPTZ,
  en_curso_by TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON public.bug_reports (status);
CREATE INDEX IF NOT EXISTS idx_bug_reports_user_email ON public.bug_reports (user_email);
CREATE INDEX IF NOT EXISTS idx_bug_reports_created_at ON public.bug_reports (created_at DESC);

ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

-- Política: solo el bot (service_role) puede acceder; anon/authenticated no tienen acceso directo
CREATE POLICY "bug_reports_service_only" ON public.bug_reports
  FOR ALL USING (false);
