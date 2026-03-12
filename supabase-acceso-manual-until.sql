-- Acceso manual (30 días): fecha de expiración.
-- Ejecutar en Supabase SQL Editor si la tabla user_discord_links ya existe.

ALTER TABLE public.user_discord_links ADD COLUMN IF NOT EXISTS acceso_manual_until TIMESTAMPTZ;
