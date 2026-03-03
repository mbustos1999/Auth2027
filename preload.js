const { contextBridge, ipcRenderer } = require('electron');

// Exponer electronAPI primero para que la ventana siempre tenga la API
contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  close: () => ipcRenderer.send('window-close')
});

// Config: main.js ya la cargó y la pasó por process.env (más fiable); si no, intentar require
let baseUrl = (process.env.AUTH_APP_BASE_URL != null) ? String(process.env.AUTH_APP_BASE_URL).trim() : '';
let authEndpoint = (process.env.AUTH_APP_AUTH_ENDPOINT != null) ? String(process.env.AUTH_APP_AUTH_ENDPOINT).trim() : '';
if (!baseUrl || !authEndpoint) {
  try {
    const config = require('./config.js');
    if (config) {
      if (!baseUrl) baseUrl = (config.API_BASE_URL != null) ? String(config.API_BASE_URL).trim() : '';
      if (!authEndpoint) authEndpoint = (config.AUTH_ENDPOINT != null) ? String(config.AUTH_ENDPOINT).trim() : '';
    }
  } catch (_) {}
}

contextBridge.exposeInMainWorld('apiConfig', {
  baseUrl,
  authEndpoint
});
