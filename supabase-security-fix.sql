-- =============================================================================
-- PARCHE DE SEGURIDAD: Cerrar vulnerabilidades de doxxing y filtración de PII
-- =============================================================================
-- Ejecutar en Supabase SQL Editor (Dashboard > SQL Editor > New query).
--
-- PROBLEMA: Las políticas anon en user_discord_links permitían que CUALQUIERA
-- con la anon key de Supabase pudiera:
--   - SELECT * de TODAS las filas (doxxing de Discord: email + discord_id + username)
--   - Filtrar PII de Mercadopago (mercadopago_data contiene nombre, montos, etc.)
--
-- SOLUCIÓN: Eliminar acceso anon. El bot usa service_role (bypasea RLS) para
-- todas las operaciones. La app Electron usa fetchBot al backend, no Supabase.
-- =============================================================================

-- 1) Eliminar política SELECT anon (la más peligrosa: exponía todos los datos)
DROP POLICY IF EXISTS "anon_select_user_discord_links" ON public.user_discord_links;

-- 2) Eliminar política INSERT anon (evita que cualquiera cree filas basura)
-- Nota: El bot crea filas con service_role en el callback de Discord OAuth.
DROP POLICY IF EXISTS "anon_insert_user_discord_links" ON public.user_discord_links;

-- 3) Sin políticas para anon/authenticated, solo service_role puede acceder.
-- El bot (service_role) sigue funcionando con normalidad.

-- Verificación: tras ejecutar, en Supabase Dashboard > Authentication > Policies
-- la tabla user_discord_links no debe tener políticas para anon.
