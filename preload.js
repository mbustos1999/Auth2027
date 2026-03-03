const { contextBridge, ipcRenderer } = require('electron');

// Exponer electronAPI primero para que la ventana siempre tenga la API
contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  close: () => ipcRenderer.send('window-close')
});

// Config: main.js ya la cargó y la pasó por process.env (más fiable); si no, intentar require
let baseUrl = (process.env.AUTH_APP_BASE_URL != null) ? String(process.env.AUTH_APP_BASE_URL).trim() : '';
let authEndpoint = (process.env.AUTH_APP_AUTH_ENDPOINT != null) ? String(process.env.AUTH_APP_AUTH_ENDPOINT).trim() : '';
let supabaseUrl = (process.env.SUPABASE_URL != null) ? String(process.env.SUPABASE_URL).trim() : '';
let supabaseAnonKey = (process.env.SUPABASE_ANON_KEY != null) ? String(process.env.SUPABASE_ANON_KEY).trim() : '';
let discordInviteUrl = (process.env.DISCORD_INVITE_URL != null) ? String(process.env.DISCORD_INVITE_URL).trim() : '';
let discordOAuthBaseUrl = (process.env.DISCORD_OAUTH_BASE_URL != null) ? String(process.env.DISCORD_OAUTH_BASE_URL).trim() : '';
if (!baseUrl || !authEndpoint) {
  try {
    const config = require('./config.js');
    if (config) {
      if (!baseUrl) baseUrl = (config.API_BASE_URL != null) ? String(config.API_BASE_URL).trim() : '';
      if (!authEndpoint) authEndpoint = (config.AUTH_ENDPOINT != null) ? String(config.AUTH_ENDPOINT).trim() : '';
      if (!supabaseUrl) supabaseUrl = (config.SUPABASE_URL != null) ? String(config.SUPABASE_URL).trim() : '';
      if (!supabaseAnonKey) supabaseAnonKey = (config.SUPABASE_ANON_KEY != null) ? String(config.SUPABASE_ANON_KEY).trim() : '';
      if (!discordInviteUrl && config.DISCORD_INVITE_URL) {
        discordInviteUrl = String(config.DISCORD_INVITE_URL).trim();
      }
      if (!discordOAuthBaseUrl && config.DISCORD_OAUTH_BASE_URL) {
        discordOAuthBaseUrl = String(config.DISCORD_OAUTH_BASE_URL).trim();
      }
    }
  } catch (_) {}
}

contextBridge.exposeInMainWorld('apiConfig', {
  baseUrl,
  authEndpoint,
  supabaseUrl,
  supabaseAnonKey,
  discordInviteUrl,
  discordOAuthBaseUrl
});
