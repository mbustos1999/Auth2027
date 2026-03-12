-- Migración: quitar imágenes/archivo base64, añadir link Transfer.it y estado "En curso"
-- Ejecutar en Supabase SQL Editor (después de supabase-bug-reports.sql si ya existe la tabla).

-- Si la tabla ya existe con la estructura antigua, ejecutar estos ALTER:
ALTER TABLE public.bug_reports DROP COLUMN IF EXISTS image1_data;
ALTER TABLE public.bug_reports DROP COLUMN IF EXISTS image2_data;
ALTER TABLE public.bug_reports DROP COLUMN IF EXISTS image3_data;
ALTER TABLE public.bug_reports DROP COLUMN IF EXISTS career_file_data;
ALTER TABLE public.bug_reports DROP COLUMN IF EXISTS career_file_name;

ALTER TABLE public.bug_reports ADD COLUMN IF NOT EXISTS career_file_url TEXT;
ALTER TABLE public.bug_reports ADD COLUMN IF NOT EXISTS en_curso_at TIMESTAMPTZ;
ALTER TABLE public.bug_reports ADD COLUMN IF NOT EXISTS en_curso_by TEXT;

-- Actualizar constraint de status para incluir 'en_curso'
ALTER TABLE public.bug_reports DROP CONSTRAINT IF EXISTS bug_reports_status_check;
ALTER TABLE public.bug_reports ADD CONSTRAINT bug_reports_status_check
  CHECK (status IN ('pending', 'en_curso', 'resolved'));
