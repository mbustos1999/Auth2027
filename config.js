const defaultApiBaseUrl = 'https://argenmod.com';
const defaultAuthEndpoint = '/wp-json/argenmod/v1/validar-login';
const defaultSupabaseUrl = 'https://vdpghetcckgbpxcqcsdm.supabase.co';
const defaultSupabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkcGdoZXRjY2tnYnB4Y3Fjc2RtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0OTc0NzksImV4cCI6MjA4ODA3MzQ3OX0.ntsYSC8BHD0HPT-h-WbUGve-4c5Gz7VMEG258UCNt7I';
const defaultDiscordOAuthBaseUrl =
  'https://discord.com/oauth2/authorize?client_id=1364442374540890142&redirect_uri=https://auth2027-production.up.railway.app/auth/discord/callback&response_type=code&scope=identify%20email';
// En desarrollo: .env. En app empaquetada: build-config.js (generado en npm run build desde .env)
let botSharedSecret = (process.env.BOT_SHARED_SECRET || '').trim();
if (!botSharedSecret) {
  try {
    const buildConfig = require('./build-config.js');
    if (buildConfig && typeof buildConfig.BOT_SHARED_SECRET === 'string') {
      botSharedSecret = buildConfig.BOT_SHARED_SECRET.trim();
    }
  } catch (_) {}
}

module.exports = {
  API_BASE_URL: process.env.AUTH_API_URL || 'https://argenmod.com',
  AUTH_ENDPOINT: process.env.AUTH_ENDPOINT || '/wp-json/argenmod/v1/validar-login',
  SUPABASE_URL: process.env.SUPABASE_URL || defaultSupabaseUrl,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || defaultSupabaseAnonKey,
  DISCORD_INVITE_URL: process.env.DISCORD_INVITE_URL,
  DISCORD_OAUTH_BASE_URL: process.env.DISCORD_OAUTH_BASE_URL || defaultDiscordOAuthBaseUrl,
  MERCADOPAGO_ACCESS_TOKEN_CHILE: process.env.MERCADOPAGO_ACCESS_TOKEN_CHILE,
  MERCADOPAGO_ACCESS_TOKEN_ARG: process.env.MERCADOPAGO_ACCESS_TOKEN_ARG,
  BOT_SHARED_SECRET: botSharedSecret
};
