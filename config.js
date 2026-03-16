const defaultApiBaseUrl = 'https://argenmod.com';
const defaultAuthEndpoint = '/wp-json/argenmod/v1/validar-login';
const defaultSupabaseUrl = 'https://vdpghetcckgbpxcqcsdm.supabase.co';
// Usar SUPABASE_ANON_KEY desde .env. No hardcodear en producción.
const defaultSupabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const defaultDiscordOAuthBaseUrl =
  'https://discord.com/oauth2/authorize?client_id=1364442374540890142&redirect_uri=https://auth2027-production.up.railway.app/auth/discord/callback&response_type=code&scope=identify%20email';
// 

module.exports = {
  API_BASE_URL: process.env.AUTH_API_URL || 'https://argenmod.com',
  AUTH_ENDPOINT: process.env.AUTH_ENDPOINT || '/wp-json/argenmod/v1/validar-login',
  SUPABASE_URL: process.env.SUPABASE_URL || defaultSupabaseUrl,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || defaultSupabaseAnonKey,
  DISCORD_INVITE_URL: process.env.DISCORD_INVITE_URL,
  DISCORD_OAUTH_BASE_URL: process.env.DISCORD_OAUTH_BASE_URL || defaultDiscordOAuthBaseUrl,
  MERCADOPAGO_ACCESS_TOKEN_CHILE: process.env.MERCADOPAGO_ACCESS_TOKEN_CHILE,
  MERCADOPAGO_ACCESS_TOKEN_ARG: process.env.MERCADOPAGO_ACCESS_TOKEN_ARG
};
