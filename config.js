// En desarrollo se usan las variables de .env. En la app empaquetada no hay .env,
// así que se usan estos valores por defecto (cámbialos antes de hacer build si necesitas otra API).
const defaultApiBaseUrl = 'https://argenmod.com';
const defaultAuthEndpoint = '/wp-json/argenmod/v1/validar-login';

module.exports = {
  API_BASE_URL: process.env.AUTH_API_URL || defaultApiBaseUrl,
  AUTH_ENDPOINT: process.env.AUTH_ENDPOINT || defaultAuthEndpoint,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  DISCORD_INVITE_URL: process.env.DISCORD_INVITE_URL,
  DISCORD_OAUTH_BASE_URL: process.env.DISCORD_OAUTH_BASE_URL,
  MERCADOPAGO_ACCESS_TOKEN_CHILE: process.env.MERCADOPAGO_ACCESS_TOKEN_CHILE,
  MERCADOPAGO_ACCESS_TOKEN_ARG: process.env.MERCADOPAGO_ACCESS_TOKEN_ARG,
  BOT_SHARED_SECRET: process.env.BOT_SHARED_SECRET
};
