# Rotación de claves tras incidente de seguridad

Si hubo filtración o sospecha de que claves fueron expuestas, **rota todas las claves** y despliega las nuevas.

## 1. BOT_SHARED_SECRET (Bot en Railway)

1. Genera un nuevo secreto: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. En Railway → tu proyecto del bot → Variables → `BOT_SHARED_SECRET` → pegar el nuevo valor
3. Redeploy del bot

**Nota:** El bot ya no acepta `X-Auth2027-Secret` como autenticación; solo tokens. Rotar invalida cualquier secreto que alguien haya extraído de versiones antiguas.

## 2. SUPABASE_ANON_KEY

1. Supabase Dashboard → Settings → API
2. Regenerar la "anon public" key
3. Actualizar en el bot (si lo usa) y en cualquier `.env` de desarrollo
4. La app empaquetada **no** debe tener la anon key; si la tenía, las nuevas builds ya no la incluyen

## 3. SUPABASE_SERVICE_ROLE_KEY

1. Supabase Dashboard → Settings → API
2. Regenerar la "service_role" key
3. Actualizar en Railway (bot) → `SUPABASE_SERVICE_ROLE_KEY`
4. Redeploy del bot

## 4. Tokens de MercadoPago

1. MercadoPago Developers → Tus aplicaciones → Credenciales
2. Regenerar Access Token (Chile y/o Argentina)
3. Actualizar en Railway (bot) → `MERCADOPAGO_ACCESS_TOKEN_CHILE`, `MERCADOPAGO_ACCESS_TOKEN_ARG`
4. Redeploy del bot

**Nota:** La app Electron **nunca** usa tokens de MercadoPago; solo el bot.

## 5. Discord (opcional)

Si el token del bot de Discord pudo haberse expuesto:
1. Discord Developer Portal → Bot → Reset Token
2. Actualizar en Railway → `DISCORD_BOT_TOKEN`
3. Redeploy

## Verificación post-rotación

- [ ] Bot desplegado con nuevas variables
- [ ] App nueva publicada (sin secretos en el build)
- [ ] Quitar rol admin a usuarios comprometidos en Discord y Supabase
- [ ] Revisar `user_discord_links.roles` en Supabase para el atacante
