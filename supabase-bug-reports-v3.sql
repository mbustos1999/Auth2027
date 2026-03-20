-- Migración: problema_tipo y resuelto_en_mod en bug_reports
-- Ejecutar en Supabase SQL Editor.

ALTER TABLE public.bug_reports ADD COLUMN IF NOT EXISTS problema_tipo TEXT DEFAULT NULL;
ALTER TABLE public.bug_reports ADD COLUMN IF NOT EXISTS resuelto_en_mod TEXT DEFAULT 'no';

-- Valores permitidos: problema_tipo: 'error_mod', 'error_usuario'
-- resuelto_en_mod: 'si', 'no', 'no_aplica'
