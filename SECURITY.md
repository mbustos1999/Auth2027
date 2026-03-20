# Seguridad - Argenmod Auth

## Vulnerabilidad corregida (doxxing + PII)

Se identificó y corrigió una vulnerabilidad crítica en las políticas RLS de Supabase:

- **Problema:** `anon_select_user_discord_links` con `USING (true)` permitía que cualquiera con la anon key leyera **todas** las filas de `user_discord_links`.
- **Riesgo:** Doxxing de usuarios (email + discord_id + discord_username) y filtración de PII de Mercadopago (`mercadopago_data`).
- **Solución:** Ejecutar `supabase-security-fix.sql` en el SQL Editor de Supabase.

## Acciones inmediatas

1. **Ejecutar el parche:** En Supabase Dashboard → SQL Editor → pegar y ejecutar el contenido de `supabase-security-fix.sql`.

2. **Rotar claves:** Si hubo filtración, seguir `KEY_ROTATION.md` para rotar BOT_SHARED_SECRET, Supabase keys, MercadoPago, etc.

3. **No empaquetar .env:** La app no debe incluir `.env` ni tokens. El build excluye `!**/.env`, `!build-config.js`.

## Medidas implementadas

### Bot (API HTTP)

- **Headers de seguridad:** `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Strict-Transport-Security`.
- **Rate limiting:** Por IP y bucket (mp_status, u_state, admin, etc.) para mitigar fuerza bruta.
- **Validación de entrada:** Emails validados con `isValidEmail()`; longitud de `pc` limitada.
- **Logging de seguridad:** Eventos `[SEC]` para rate_limit, session_invalid, unauthorized.
- **Minimización PII:** `sanitizeMercadoPagoForClient()` devuelve solo meta + primer resultado con campos mínimos (reason, amount, payer_name, status, days_left). No se envían objetos completos de MercadoPago.

### Secretos

- **.gitignore:** `.env`, `.env.local`, `config.local.js`, `build-config.js`.
- **.env.example:** Plantillas en raíz y `bot/` con todas las variables necesarias.

### Supabase

- **Auditoría:** Tabla `security_audit_log` (opcional, ver `supabase-audit.sql`) para registrar eventos futuros.

## Buenas prácticas

- **Anon key:** Está pensada para ser pública en apps cliente. La seguridad viene de las políticas RLS, no de ocultar la key.
- **Service role key:** NUNCA exponerla. Solo el bot (backend) debe usarla. No incluirla en builds de la app.
- **mercadopago_data:** En DB se guarda completo; al cliente solo se envía la versión sanitizada.
- **Políticas RLS:** Por defecto, sin políticas = nadie accede. Solo añadir políticas cuando sea estrictamente necesario.
- **BOT_SHARED_SECRET:** Solo en el bot (Railway). La app **nunca** lo tiene ni lo envía. Si hubo filtración, ver `KEY_ROTATION.md`.

## Tablas y acceso

| Tabla               | anon/authenticated | service_role (bot) |
|---------------------|--------------------|---------------------|
| user_discord_links  | Sin acceso         | Sí                  |
| bug_reports        | Sin acceso         | Sí                  |
| access_requests     | Sin acceso         | Sí                  |
| security_audit_log  | Sin acceso         | Sí                  |

## Vulnerabilidades adicionales corregidas

### "Envían todo el stack al cliente"
- **Problema:** `/admin/users` devolvía `select('*')` con `mercadopago_data` completo (PII) de hasta 500 usuarios.
- **Solución:** Solo se devuelven campos necesarios; `mercadopago_data` se sanitiza (solo meta para etiquetas de UI, sin nombres ni montos).

### R2 / Cloudflare
- Las URLs en `mods-manifest.json` apuntan a un bucket R2 público (`pub-*.r2.dev`). No hay token en el repo.
- **Importante:** Si usas un token de R2 para subir archivos (CI, script, etc.), NUNCA lo incluyas en el repo. Guárdalo en variables de entorno o secretos de GitHub.

### Token de GitHub
- No usar tokens de GitHub en el código. Si hace falta (releases privados, etc.), usar `GITHUB_TOKEN` desde variables de entorno.

## Auditoría de seguridad (revisión completa)

### Cambios aplicados

1. **Config:** Anon key ya no hardcodeada; debe venir de `SUPABASE_ANON_KEY` en `.env`.

2. **Electron main.js:**
   - `shell:openExternal`: solo permite URLs `http://` o `https://` válidas (rechaza `javascript:`, `file:`).
   - `shell:openFolder`: rechaza rutas con `..` (path traversal).

3. **Bot:**
   - Límites de longitud: `equipo` (200), `problema` (5000), `pc_name` (100).
   - `admin/users/update`: solo permite `status` = `pending` o `linked`; `pc_name` limitado.
   - `home_cards`: `image_url` y `logo_url` deben ser `http://` o `https://`; `title` y `description` con límites.

4. **Renderer (XSS):**
   - `safeUrlForHref()`: solo URLs http/https para enlaces (p. ej. `career_file_url`).
   - `escapeHtml()` ya usado en datos de usuario; `career_file_url` validado antes de usarse en `href`.
