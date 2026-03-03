module.exports = {
  API_BASE_URL: process.env.AUTH_API_URL,
  AUTH_ENDPOINT: process.env.AUTH_ENDPOINT,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  DISCORD_INVITE_URL: process.env.DISCORD_INVITE_URL, // ej: https://discord.gg/tu-invite
  // URL base de OAuth de Discord, sin el parámetro "state".
  // Ejemplo:
  // https://discord.com/api/oauth2/authorize?client_id=TU_CLIENT_ID&redirect_uri=URL_ENCODEADA&response_type=code&scope=identify
  DISCORD_OAUTH_BASE_URL: process.env.DISCORD_OAUTH_BASE_URL
};
