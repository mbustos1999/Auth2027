-- Información de setup (orden mods, teams, squad) para bugs y usuarios
-- Ejecutar en Supabase SQL Editor.

-- Bug reports: añadir columnas de setup al momento del reporte
ALTER TABLE public.bug_reports ADD COLUMN IF NOT EXISTS mod_order_ok BOOLEAN;
ALTER TABLE public.bug_reports ADD COLUMN IF NOT EXISTS teams_ok BOOLEAN;
ALTER TABLE public.bug_reports ADD COLUMN IF NOT EXISTS squad_applied BOOLEAN;

-- User discord links: setup actualizado en login/logout
ALTER TABLE public.user_discord_links ADD COLUMN IF NOT EXISTS mod_order_ok BOOLEAN;
ALTER TABLE public.user_discord_links ADD COLUMN IF NOT EXISTS teams_ok BOOLEAN;
ALTER TABLE public.user_discord_links ADD COLUMN IF NOT EXISTS squad_applied BOOLEAN;
ALTER TABLE public.user_discord_links ADD COLUMN IF NOT EXISTS setup_info_updated_at TIMESTAMPTZ;
ALTER TABLE public.user_discord_links ADD COLUMN IF NOT EXISTS switcher_abierto BOOLEAN DEFAULT false;
