const { contextBridge, ipcRenderer } = require('electron');

// Exponer electronAPI primero para que la ventana siempre tenga la API
contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  close: () => ipcRenderer.send('window-close'),
  toggleFullscreen: () => ipcRenderer.send('window-toggle-fullscreen'),
  isFullScreen: () => ipcRenderer.invoke('window-is-fullscreen'),
  onFullscreenChange: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const handler = (_e, isFull) => callback(isFull);
    ipcRenderer.on('fullscreen-changed', handler);
    return () => ipcRenderer.removeListener('fullscreen-changed', handler);
  },
  // Control de acceso al archivo fifa_ng_db.DB
  setGameDbAccess: (enabled) => ipcRenderer.invoke('game-db:set', !!enabled),
  // Auto-actualización (solo activa en app empaquetada)
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  quitAndInstall: () => ipcRenderer.send('update:quitAndInstall'),
  onUpdateStatus: (callback) => {
    if (typeof callback !== 'function') return;
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('update-status', handler);
    return () => ipcRenderer.removeListener('update-status', handler);
  },
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
  getConfig: () => ipcRenderer.invoke('app:getConfig'),
  clearCache: () => ipcRenderer.invoke('app:clearCache'),
  listSwitcherMarkers: () => ipcRenderer.invoke('switcher:listMarkers'),
  applySwitcherMarker: (markerId) => ipcRenderer.invoke('switcher:applyMarker', markerId),
  clearSwitcherOverlay: () => ipcRenderer.invoke('switcher:clearOverlay'),
  listSwitcherTvs: () => ipcRenderer.invoke('switcher:listTvs'),
  applySwitcherTv: (tvId) => ipcRenderer.invoke('switcher:applyTv', tvId),
  clearSwitcherTvOverlay: () => ipcRenderer.invoke('switcher:clearTvOverlay'),
  listSwitcherPublicities: () => ipcRenderer.invoke('switcher:listPublicities'),
  applySwitcherPublicity: (pubId) => ipcRenderer.invoke('switcher:applyPublicity', pubId),
  clearSwitcherPublicity: () => ipcRenderer.invoke('switcher:clearPublicity'),
  checkSquadStatus: () => ipcRenderer.invoke('switcher:checkSquad'),
  applySquad: () => ipcRenderer.invoke('switcher:applySquad'),
  getTeamsStatus: () => ipcRenderer.invoke('teams:getStatus'),
  launchModManager: () => ipcRenderer.invoke('modmanager:launch'),
  launchLauncher: () => ipcRenderer.invoke('launcher:launch'),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  getModsManifestLocal: () => ipcRenderer.invoke('mods:getManifest'),
  downloadMods: (url) => ipcRenderer.invoke('mods:download', url),
  onModsDownloadProgress: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const handler = (_e, data) => callback(data);
    ipcRenderer.on('mods-download-progress', handler);
    return () => ipcRenderer.removeListener('mods-download-progress', handler);
  },
  // Peticiones al bot: el main añade secreto + token de sesión (el renderer nunca ve el secreto)
  fetchBot: (url, options) => ipcRenderer.invoke('bot:fetch', url, options),
  setSessionUser: (email) => ipcRenderer.invoke('bot:setSessionUser', email),
  clearSessionUser: () => ipcRenderer.invoke('bot:clearSessionUser')
});

// Config: main.js ya la cargó y la pasó por process.env (más fiable); si no, intentar require
let baseUrl = (process.env.AUTH_APP_BASE_URL != null) ? String(process.env.AUTH_APP_BASE_URL).trim() : '';
let authEndpoint = (process.env.AUTH_APP_AUTH_ENDPOINT != null) ? String(process.env.AUTH_APP_AUTH_ENDPOINT).trim() : '';
let supabaseUrl = (process.env.SUPABASE_URL != null) ? String(process.env.SUPABASE_URL).trim() : '';
let supabaseAnonKey = (process.env.SUPABASE_ANON_KEY != null) ? String(process.env.SUPABASE_ANON_KEY).trim() : '';
let discordInviteUrl = (process.env.DISCORD_INVITE_URL != null) ? String(process.env.DISCORD_INVITE_URL).trim() : '';
let discordOAuthBaseUrl = (process.env.DISCORD_OAUTH_BASE_URL != null) ? String(process.env.DISCORD_OAUTH_BASE_URL).trim() : '';
let mercadopagoAccessTokenChile = (process.env.MERCADOPAGO_ACCESS_TOKEN_CHILE != null) ? String(process.env.MERCADOPAGO_ACCESS_TOKEN_CHILE).trim() : '';
let mercadopagoAccessTokenArg = (process.env.MERCADOPAGO_ACCESS_TOKEN_ARG != null) ? String(process.env.MERCADOPAGO_ACCESS_TOKEN_ARG).trim() : '';
let pcName = (process.env.AUTH_APP_PC_NAME != null) ? String(process.env.AUTH_APP_PC_NAME).trim() : '';

if (!baseUrl || !authEndpoint || (!mercadopagoAccessTokenChile && !mercadopagoAccessTokenArg)) {
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
      if (!mercadopagoAccessTokenChile && config.MERCADOPAGO_ACCESS_TOKEN_CHILE) {
        mercadopagoAccessTokenChile = String(config.MERCADOPAGO_ACCESS_TOKEN_CHILE).trim();
      }
      if (!mercadopagoAccessTokenArg && config.MERCADOPAGO_ACCESS_TOKEN_ARG) {
        mercadopagoAccessTokenArg = String(config.MERCADOPAGO_ACCESS_TOKEN_ARG).trim();
      }
    }
  } catch (_) {}
}

// No exponer botSharedSecret al renderer; las peticiones al bot pasan por main (fetchBot)
contextBridge.exposeInMainWorld('apiConfig', {
  baseUrl,
  authEndpoint,
  discordInviteUrl,
  discordOAuthBaseUrl,
  pcName
});
