-- Motivo de rechazo de solicitud de acceso manual (para mostrar al usuario en la tarjeta Mercado Pago).
-- Ejecutar en Supabase SQL Editor si la tabla user_discord_links ya existe.

ALTER TABLE public.user_discord_links ADD COLUMN IF NOT EXISTS access_request_rejection_reason TEXT;
ALTER TABLE public.user_discord_links ADD COLUMN IF NOT EXISTS access_request_rejection_at TIMESTAMPTZ;
