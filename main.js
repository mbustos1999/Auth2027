const { app, BrowserWindow, ipcMain, screen, shell, net } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const { spawn } = require('child_process');
const unzipper = require('unzipper');
require('dotenv').config();
// En app empaquetada no existe .env del proyecto; cargar desde userData si existe
try {
  if (app.isPackaged) {
    const userDataEnv = path.join(app.getPath('userData'), '.env');
    if (fs.existsSync(userDataEnv)) {
      require('dotenv').config({ path: userDataEnv });
    }
  }
} catch (_) {}

// Sesión de usuario para peticiones al bot (token firmado; el renderer no ve el secreto)
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 h
let sessionEmail = null;
let sessionExpiry = 0;

function createSessionToken(email) {
  const secret = (sharedAppConfig && sharedAppConfig.botSharedSecret) ? String(sharedAppConfig.botSharedSecret).trim() : '';
  if (!secret || !email) return '';
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = JSON.stringify({ e: String(email).trim(), exp });
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return Buffer.from(payload).toString('base64url') + '.' + sig;
}

// Auto-updater (solo cuando la app está empaquetada)
let autoUpdater = null;
if (app.isPackaged) {
  try {
    autoUpdater = require('electron-updater').autoUpdater;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
  } catch (e) {
    console.warn('electron-updater no disponible:', e.message);
  }
}
// Cargar config al arranque (en el instalador __dirname apunta a app.asar); se reutiliza en app:getConfig
const USER_DATA_CONFIG_FILENAME = 'argenmod-auth-config.json';
let sharedAppConfig = {};
try {
  const config = require('./config.js');
  if (config) {
    process.env.AUTH_APP_BASE_URL = (config.API_BASE_URL != null) ? String(config.API_BASE_URL).trim() : '';
    process.env.AUTH_APP_AUTH_ENDPOINT = (config.AUTH_ENDPOINT != null) ? String(config.AUTH_ENDPOINT).trim() : '';
    const defaultPcName = (process.env.AUTH_APP_PC_NAME != null) ? String(process.env.AUTH_APP_PC_NAME).trim() : (typeof os.hostname === 'function' ? os.hostname() : '');
    sharedAppConfig = {
      baseUrl: (config.API_BASE_URL != null) ? String(config.API_BASE_URL).trim() : '',
      authEndpoint: (config.AUTH_ENDPOINT != null) ? String(config.AUTH_ENDPOINT).trim() : '',
      discordOAuthBaseUrl: (config.DISCORD_OAUTH_BASE_URL != null) ? String(config.DISCORD_OAUTH_BASE_URL).trim() : '',
      pcName: defaultPcName || 'PC',
      botSharedSecret: (config.BOT_SHARED_SECRET != null) ? String(config.BOT_SHARED_SECRET).trim() : ''
    };
    // App empaquetada: si no hay secreto por .env, intentar desde el archivo de config en userData
    if (app.isPackaged && !sharedAppConfig.botSharedSecret) {
      try {
        const cfgPath = path.join(app.getPath('userData'), USER_DATA_CONFIG_FILENAME);
        if (fs.existsSync(cfgPath)) {
          const raw = fs.readFileSync(cfgPath, 'utf8');
          const data = JSON.parse(raw);
          if (data && typeof data.botSharedSecret === 'string' && data.botSharedSecret.trim()) {
            sharedAppConfig.botSharedSecret = data.botSharedSecret.trim();
          }
        }
      } catch (_) {}
    }
  }
} catch (_) {}

function loadPersistedPcName() {
  try {
    const userDataPath = app.getPath('userData');
    const configPath = path.join(userDataPath, USER_DATA_CONFIG_FILENAME);
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf8');
      const data = JSON.parse(raw);
      if (data && typeof data.pcName === 'string' && data.pcName.trim() !== '') {
        sharedAppConfig.pcName = data.pcName.trim();
        return;
      }
    }
  } catch (_) {}
  try {
    const userDataPath = app.getPath('userData');
    const configPath = path.join(userDataPath, USER_DATA_CONFIG_FILENAME);
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify({ pcName: sharedAppConfig.pcName || (typeof os.hostname === 'function' ? os.hostname() : 'PC') }, null, 2), 'utf8');
  } catch (_) {}
}

// Nombre del PC (para anclar cuenta a equipo)
if (!process.env.AUTH_APP_PC_NAME) {
  try {
    process.env.AUTH_APP_PC_NAME = os.hostname();
  } catch (_) {
    process.env.AUTH_APP_PC_NAME = '';
  }
}
if (!process.env.AUTH_APP_BASE_URL) process.env.AUTH_APP_BASE_URL = '';
if (!process.env.AUTH_APP_AUTH_ENDPOINT) process.env.AUTH_APP_AUTH_ENDPOINT = '';

let mainWindow;

// Ruta del archivo de base de datos del juego
// Origen: carpeta DB dentro de la app
const gameDbSourcePath = path.join(__dirname, 'DB', 'fifa_ng_db.DB');
// Destino fijo solicitado por el usuario
const gameDbTargetPath = path.join(
  'C:',
  'FC 26 Live Editor',
  'mods',
  'legacy',
  'data',
  'db',
  'fifa_ng_db.DB'
);

const teamsSourcePath = path.join(__dirname, 'DB', 'LE_CM_SUPPORTED_LEAGUES_AND_TEAMS.CSV');

const teamsTargetPath = path.join(
  'C:',
  'FC 26 Live Editor',
  'mods',
  'legacy',
  'data',
  'LE_CM_SUPPORTED_LEAGUES_AND_TEAMS.CSV'
);

const overlayTargetDir = path.join(
  'C:',
  'FC 26 Live Editor',
  'mods',
  'legacy',
  'data',
  'ui',
  'game',
  'overlays',
  'Generic'
);

const layoutTargetDir = path.join(
  'C:',
  'FC 26 Live Editor',
  'mods',
  'legacy',
  'data',
  'ui',
  'layout'
);

const themesTargetDir = path.join(
  'C:',
  'FC 26 Live Editor',
  'mods',
  'legacy',
  'data',
  'ui',
  'themes'
);

const adboardsTargetDir = path.join(
  'C:',
  'FC 26 Live Editor',
  'mods',
  'legacy',
  'data',
  'ui',
  'game',
  'adboards'
);

const fchubTargetDir = path.join(
  'C:',
  'FC 26 Live Editor',
  'mods',
  'legacy',
  'data',
  'ui',
  'imgAssets',
  'fchub'
);

const eaSettingsDir = path.join(
  os.homedir(),
  'AppData',
  'Local',
  'EA SPORTS FC 26',
  'settings'
);

function ensureGameDbPresent() {
  try {
    if (!fs.existsSync(gameDbSourcePath)) {
      console.warn('Archivo fifa_ng_db.DB de origen no encontrado:', gameDbSourcePath);
      return { ok: false, error: 'missing_source' };
    }

    const targetDir = path.dirname(gameDbTargetPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    fs.copyFileSync(gameDbSourcePath, gameDbTargetPath);
    return { ok: true };
  } catch (e) {
    console.error('Error al copiar fifa_ng_db.DB:', e);
    return { ok: false, error: e.message || 'copy_error' };
  }
}

function removeGameDbIfExists() {
  try {
    if (fs.existsSync(gameDbTargetPath)) {
      fs.unlinkSync(gameDbTargetPath);
    }
    return { ok: true };
  } catch (e) {
    console.error('Error al eliminar fifa_ng_db.DB de destino:', e);
    return { ok: false, error: e.message || 'delete_error' };
  }
}

function ensureTeamsPresent() {
  try {
    if (!fs.existsSync(teamsSourcePath)) {
      console.warn('Archivo LE_CM_SUPPORTED_LEAGUES_AND_TEAMS.CSV de origen no encontrado:', teamsSourcePath);
      return { ok: false, error: 'missing_source' };
    }
    const targetDir = path.dirname(teamsTargetPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    fs.copyFileSync(teamsSourcePath, teamsTargetPath);
    return { ok: true };
  } catch (e) {
    console.error('Error al copiar LE_CM_SUPPORTED_LEAGUES_AND_TEAMS.CSV:', e);
    return { ok: false, error: e.message || 'copy_error' };
  }
}

function removeTeamsIfExists() {
  try {
    if (fs.existsSync(teamsTargetPath)) {
      fs.unlinkSync(teamsTargetPath);
    }
    return { ok: true };
  } catch (e) {
    console.error('Error al eliminar LE_CM_SUPPORTED_LEAGUES_AND_TEAMS.CSV de destino:', e);
    return { ok: false, error: e.message || 'delete_error' };
  }
}

function removeOverlayFileByPrefix(prefix) {
  try {
    if (!fs.existsSync(overlayTargetDir)) return { ok: true };
    const entries = fs.readdirSync(overlayTargetDir, { withFileTypes: true });
    const targetLower = String(prefix || '').toLowerCase();
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const nameLower = entry.name.toLowerCase();
      if (!targetLower || !nameLower.startsWith(targetLower)) continue;
      const fullPath = path.join(overlayTargetDir, entry.name);
      try {
        fs.unlinkSync(fullPath);
      } catch (e) {
        console.error('Error al eliminar overlay', entry.name, e);
      }
    }
    return { ok: true };
  } catch (e) {
    console.error('Error al eliminar overlays por prefijo', prefix, e);
    return { ok: false, error: e.message || 'delete_overlay_error' };
  }
}

function clearOverlayTargetDir() {
  // Eliminar todos los overlays conocidos (al cerrar app/sesión)
  const r1 = removeOverlayFileByPrefix('overlay_9002');
  const r2 = removeOverlayFileByPrefix('overlay_9105');
  if (r1.ok === false) return r1;
  if (r2.ok === false) return r2;
  return { ok: true };
}

function scanMarkers() {
  const markersBasePath = path.join(__dirname, 'marcadores');
  const result = [];
  try {
    if (!fs.existsSync(markersBasePath)) return result;
    const entries = fs.readdirSync(markersBasePath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const id = entry.name;
      const base = path.join(markersBasePath, id);
      const logoDir = path.join(base, 'logo');
      const markerDir = path.join(base, 'marcador');
      const overlayDir = path.join(base, 'overlay');

      let logoWebPath = null;
      if (fs.existsSync(logoDir)) {
        const logoFiles = fs.readdirSync(logoDir).filter((f) => !f.startsWith('.'));
        if (logoFiles.length > 0) {
          logoWebPath = path.join('marcadores', id, 'logo', logoFiles[0]).replace(/\\/g, '/');
        }
      }

      let markerWebPath = null;
      if (fs.existsSync(markerDir)) {
        const markerFiles = fs.readdirSync(markerDir).filter((f) => !f.startsWith('.'));
        if (markerFiles.length > 0) {
          markerWebPath = path.join('marcadores', id, 'marcador', markerFiles[0]).replace(/\\/g, '/');
        }
      }

      let overlayPath = null;
      const overlayFile = path.join(overlayDir, 'overlay_9002.big');
      if (fs.existsSync(overlayFile)) {
        overlayPath = overlayFile;
      }

      result.push({
        id,
        name: id,
        logoSrc: logoWebPath,
        markerSrc: markerWebPath,
        overlayPath
      });
    }
  } catch (e) {
    console.error('Error al escanear marcadores:', e);
  }
  return result;
}

function scanTvs() {
  const tvBasePath = path.join(__dirname, 'tv');
  const result = [];
  try {
    if (!fs.existsSync(tvBasePath)) return result;
    const entries = fs.readdirSync(tvBasePath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const id = entry.name;
      const base = path.join(tvBasePath, id);
      const imageDir = path.join(base, 'imagen');

      let imageWebPath = null;
      if (fs.existsSync(imageDir)) {
        const imgFiles = fs.readdirSync(imageDir).filter((f) => !f.startsWith('.'));
        if (imgFiles.length > 0) {
          imageWebPath = path.join('tv', id, 'imagen', imgFiles[0]).replace(/\\/g, '/');
        }
      }

      let overlayPath = null;
      // Soportar estructura directa (tv/Nombre/overlay_9105.BIG) y subcarpeta overlay/
      const overlayFileUpper = path.join(base, 'overlay_9105.BIG');
      const overlayFileLower = path.join(base, 'overlay_9105.big');
      const overlayDir = path.join(base, 'overlay');
      const overlayDirUpper = path.join(overlayDir, 'overlay_9105.BIG');
      const overlayDirLower = path.join(overlayDir, 'overlay_9105.big');
      if (fs.existsSync(overlayFileUpper)) {
        overlayPath = overlayFileUpper;
      } else if (fs.existsSync(overlayFileLower)) {
        overlayPath = overlayFileLower;
      } else if (fs.existsSync(overlayDirUpper)) {
        overlayPath = overlayDirUpper;
      } else if (fs.existsSync(overlayDirLower)) {
        overlayPath = overlayDirLower;
      }

      result.push({
        id,
        name: id,
        imageSrc: imageWebPath,
        overlayPath
      });
    }
  } catch (e) {
    console.error('Error al escanear tv:', e);
  }
  return result;
}

function ensureDirExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function clearAdboardsDir() {
  try {
    if (!fs.existsSync(adboardsTargetDir)) return { ok: true };
    const entries = fs.readdirSync(adboardsTargetDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(adboardsTargetDir, entry.name);
      try {
        if (entry.isDirectory()) {
          fs.rmSync(fullPath, { recursive: true, force: true });
        } else if (entry.isFile()) {
          fs.unlinkSync(fullPath);
        }
      } catch (e) {
        console.error('Error al limpiar adboards:', fullPath, e);
      }
    }
    return { ok: true };
  } catch (e) {
    console.error('Error al limpiar carpeta de adboards:', e);
    return { ok: false, error: e.message || 'delete_adboards_error' };
  }
}

function removeFilesByPrefix(targetDir, prefix) {
  try {
    if (!fs.existsSync(targetDir)) return { ok: true };
    const targetLower = String(prefix || '').toLowerCase();
    const entries = fs.readdirSync(targetDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const nameLower = entry.name.toLowerCase();
      if (!targetLower || !nameLower.startsWith(targetLower)) continue;
      const fullPath = path.join(targetDir, entry.name);
      try {
        fs.unlinkSync(fullPath);
      } catch (e) {
        console.error('Error al eliminar archivo por prefijo', targetDir, entry.name, e);
      }
    }
    return { ok: true };
  } catch (e) {
    console.error('Error en removeFilesByPrefix', targetDir, prefix, e);
    return { ok: false, error: e.message || 'delete_prefix_error' };
  }
}

function clearPublicityContent() {
  removeFilesByPrefix(layoutTargetDir, 'fchubcfg');
  removeFilesByPrefix(themesTargetDir, 'fifa');
  clearAdboardsDir();
  removeFilesByPrefix(fchubTargetDir, 'backgroundletterc');
}

function copyDirRecursive(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  ensureDirExists(destDir);
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function scanPublicities() {
  const basePath = path.join(__dirname, 'publicidades');
  const result = [];
  try {
    if (!fs.existsSync(basePath)) return result;
    const entries = fs.readdirSync(basePath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const id = entry.name;
      const pBase = path.join(basePath, id);

      // Logo / imagen para el combo: buscamos una imagen suelta en la raíz de la carpeta
      let imageWebPath = null;
      const rootFiles = fs.readdirSync(pBase, { withFileTypes: true });
      for (const f of rootFiles) {
        if (!f.isFile()) continue;
        const lower = f.name.toLowerCase();
        if (!/\.(png|jpg|jpeg|webp|gif|bmp)$/.test(lower)) continue;
        imageWebPath = path.join('publicidades', id, f.name).replace(/\\/g, '/');
        break;
      }

      // Archivos de config: primero en la carpeta de la publicidad, si no en la raíz de publicidades
      let layoutPath = null;
      const layoutUpper = path.join(pBase, 'fchubcfg.XML');
      const layoutLower = path.join(pBase, 'fchubcfg.xml');
      const layoutRootUpper = path.join(basePath, 'fchubcfg.XML');
      const layoutRootLower = path.join(basePath, 'fchubcfg.xml');
      if (fs.existsSync(layoutUpper)) layoutPath = layoutUpper;
      else if (fs.existsSync(layoutLower)) layoutPath = layoutLower;
      else if (fs.existsSync(layoutRootUpper)) layoutPath = layoutRootUpper;
      else if (fs.existsSync(layoutRootLower)) layoutPath = layoutRootLower;

      let themesPath = null;
      const fifaUpper = path.join(pBase, 'FIFA.XML');
      const fifaLower = path.join(pBase, 'fifa.xml');
      const fifaRootUpper = path.join(basePath, 'FIFA.XML');
      const fifaRootLower = path.join(basePath, 'fifa.xml');
      if (fs.existsSync(fifaUpper)) themesPath = fifaUpper;
      else if (fs.existsSync(fifaLower)) themesPath = fifaLower;
      else if (fs.existsSync(fifaRootUpper)) themesPath = fifaRootUpper;
      else if (fs.existsSync(fifaRootLower)) themesPath = fifaRootLower;

      // Adboards: soportar adboards, ADBOARDS, ADBORADS
      let adboardsDir = null;
      const adLocal = path.join(pBase, 'adboards');
      const adUpper = path.join(pBase, 'ADBOARDS');
      const adTypo = path.join(pBase, 'ADBORADS');
      if (fs.existsSync(adLocal)) adboardsDir = adLocal;
      else if (fs.existsSync(adUpper)) adboardsDir = adUpper;
      else if (fs.existsSync(adTypo)) adboardsDir = adTypo;

      // Fondo fchub: soportar fondo y Fondo
      let fondoPath = null;
      const fondoDir = path.join(pBase, 'fondo');
      const fondoDirCap = path.join(pBase, 'Fondo');
      const fondoDirToUse = fs.existsSync(fondoDir) ? fondoDir : fs.existsSync(fondoDirCap) ? fondoDirCap : null;
      if (fondoDirToUse) {
        const fondoFiles = fs.readdirSync(fondoDirToUse, { withFileTypes: true });
        for (const f of fondoFiles) {
          if (!f.isFile()) continue;
          const lower = f.name.toLowerCase();
          if (lower.startsWith('backgroundletterc') && lower.endsWith('.dds')) {
            fondoPath = path.join(fondoDirToUse, f.name);
            break;
          }
        }
      }

      result.push({
        id,
        name: id,
        imageSrc: imageWebPath,
        layoutPath,
        themesPath,
        adboardsDir,
        fondoPath
      });
    }
  } catch (e) {
    console.error('Error al escanear publicidades:', e);
  }
  return result;
}

function scanSquadFile() {
  const basePath = path.join(__dirname, 'aplicarSquad');
  try {
    if (!fs.existsSync(basePath)) return null;
    const entries = fs.readdirSync(basePath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (entry.name.startsWith('.')) continue;
      return {
        name: entry.name,
        fullPath: path.join(basePath, entry.name)
      };
    }
  } catch (e) {
    console.error('Error al escanear aplicarSquad:', e);
  }
  return null;
}

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const iconPath = path.join(__dirname, 'assets', 'argenmod.png');
  const mainWindowOptions = {
    width,
    height,
    minWidth: width,
    minHeight: height,
    resizable: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0a1322',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      devTools: false,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false
  };
  if (fs.existsSync(iconPath)) mainWindowOptions.icon = iconPath;

  mainWindow = new BrowserWindow(mainWindowOptions);

  // Elimina menús para que no puedan abrir DevTools ni recargar fácilmente
  if (mainWindow.removeMenu) {
    mainWindow.removeMenu();
  } else {
    mainWindow.setMenu(null);
  }

  mainWindow.loadFile('index.html');
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.maximize();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('enter-full-screen', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('fullscreen-changed', true);
  });
  mainWindow.on('leave-full-screen', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('fullscreen-changed', false);
  });
}

function setupAutoUpdater() {
  if (!autoUpdater || !mainWindow) return;
  const send = (payload) => {
    try {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update-status', payload);
    } catch (_) {}
  };
  autoUpdater.on('update-available', (info) => send({ type: 'update-available', version: info?.version }));
  autoUpdater.on('update-not-available', () => send({ type: 'update-not-available' }));
  autoUpdater.on('update-downloaded', () => send({ type: 'update-downloaded' }));
  autoUpdater.on('error', (err) => send({ type: 'error', message: err?.message || String(err) }));
  // Comprobar al arrancar (con un pequeño retraso para no bloquear la UI)
  setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 3000);
}

app.whenReady().then(() => {
  loadPersistedPcName();
  createWindow();
  setupAutoUpdater();
});

app.on('window-all-closed', () => {
  // Al cerrar todas las ventanas, aseguramos que se elimine el archivo de la ruta de destino
  removeGameDbIfExists();
  removeTeamsIfExists();
  clearOverlayTargetDir();
  clearPublicityContent();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Control de ventana sin marco (minimizar, cerrar)
ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-toggle-fullscreen', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setFullScreen(!mainWindow.isFullScreen());
  }
});
ipcMain.handle('window-is-fullscreen', () => mainWindow?.isFullScreen() ?? false);
ipcMain.on('window-close', () => {
  // Al cerrar desde el botón personalizado también limpiamos el archivo
  removeGameDbIfExists();
  removeTeamsIfExists();
  clearOverlayTargetDir();
  clearPublicityContent();
  mainWindow?.close();
});

// Control desde el renderer del acceso al archivo fifa_ng_db.DB
ipcMain.handle('game-db:set', async (_event, enabled) => {
  if (enabled) {
    const dbRes = ensureGameDbPresent();
    const teamsRes = ensureTeamsPresent();
    return {
      ok: !!(dbRes?.ok && teamsRes?.ok),
      db: dbRes,
      teams: teamsRes
    };
  }
  const dbRes = removeGameDbIfExists();
  const teamsRes = removeTeamsIfExists();
  return {
    ok: !!(dbRes?.ok && teamsRes?.ok),
    db: dbRes,
    teams: teamsRes
  };
});

ipcMain.handle('switcher:listMarkers', async () => {
  return scanMarkers();
});

ipcMain.handle('switcher:applyMarker', async (_event, markerId) => {
  try {
    const markers = scanMarkers();
    const marker = markers.find((m) => m.id === markerId);
    if (!marker || !marker.overlayPath) {
      return { ok: false, reason: 'not_found' };
    }

    const resClear = removeOverlayFileByPrefix('overlay_9002');
    if (resClear.ok === false) {
      return { ok: false, reason: resClear.error || 'clear_failed' };
    }

    const targetDir = overlayTargetDir;
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const targetPath = path.join(targetDir, 'overlay_9002.big');
    fs.copyFileSync(marker.overlayPath, targetPath);

    return { ok: true };
  } catch (e) {
    console.error('Error en switcher:applyMarker:', e);
    return { ok: false, reason: e.message || 'apply_error' };
  }
});

ipcMain.handle('switcher:clearOverlay', async () => {
  // Limpiar solo overlay de marcador
  return removeOverlayFileByPrefix('overlay_9002');
});

ipcMain.handle('switcher:listTvs', async () => {
  return scanTvs();
});

ipcMain.handle('switcher:applyTv', async (_event, tvId) => {
  try {
    const tvs = scanTvs();
    const tv = tvs.find((t) => t.id === tvId);
    if (!tv || !tv.overlayPath) {
      return { ok: false, reason: 'not_found' };
    }

    const resClear = removeOverlayFileByPrefix('overlay_9105');
    if (resClear.ok === false) {
      return { ok: false, reason: resClear.error || 'clear_failed' };
    }

    if (!fs.existsSync(overlayTargetDir)) {
      fs.mkdirSync(overlayTargetDir, { recursive: true });
    }

    const targetPath = path.join(overlayTargetDir, 'overlay_9105.BIG');
    fs.copyFileSync(tv.overlayPath, targetPath);

    return { ok: true };
  } catch (e) {
    console.error('Error en switcher:applyTv:', e);
    return { ok: false, reason: e.message || 'apply_error' };
  }
});

ipcMain.handle('switcher:clearTvOverlay', async () => {
  // Limpiar solo overlay de TV
  return removeOverlayFileByPrefix('overlay_9105');
});

ipcMain.handle('switcher:listPublicities', async () => {
  return scanPublicities();
});

ipcMain.handle('switcher:applyPublicity', async (_event, pubId) => {
  try {
    const pubs = scanPublicities();
    const pub = pubs.find((p) => p.id === pubId);
    if (!pub) {
      return { ok: false, reason: 'not_found' };
    }

    // Layout: fchubcfg.XML en .../layout (ruta fija)
    if (pub.layoutPath) {
      try {
        ensureDirExists(layoutTargetDir);
        const targetPath = path.join(layoutTargetDir, 'fchubcfg.XML');
        fs.copyFileSync(pub.layoutPath, targetPath);
      } catch (e) {
        console.error('Error al copiar fchubcfg.XML:', e);
      }
    }

    // Themes: FIFA.XML en .../themes (ruta fija)
    if (pub.themesPath) {
      try {
        ensureDirExists(themesTargetDir);
        const targetPath = path.join(themesTargetDir, 'FIFA.XML');
        fs.copyFileSync(pub.themesPath, targetPath);
      } catch (e) {
        console.error('Error al copiar FIFA.XML:', e);
      }
    }

    // Adboards: vaciar carpeta destino y copiar contenido de la publicidad
    ensureDirExists(adboardsTargetDir);
    const resAdClear = clearAdboardsDir();
    if (resAdClear.ok === false) {
      return { ok: false, reason: resAdClear.error || 'adboards_clear_failed' };
    }
    if (pub.adboardsDir) {
      try {
        copyDirRecursive(pub.adboardsDir, adboardsTargetDir);
      } catch (e) {
        console.error('Error al copiar adboards:', e);
      }
    }

    // Fondo fchub: backgroundLetterC.dds en .../imgAssets/fchub (ruta fija)
    ensureDirExists(fchubTargetDir);
    removeFilesByPrefix(fchubTargetDir, 'backgroundletterc');
    if (pub.fondoPath) {
      try {
        const targetPath = path.join(fchubTargetDir, 'backgroundLetterC.dds');
        fs.copyFileSync(pub.fondoPath, targetPath);
      } catch (e) {
        console.error('Error al copiar backgroundLetterC.dds:', e);
      }
    }

    return { ok: true };
  } catch (e) {
    console.error('Error en switcher:applyPublicity:', e);
    return { ok: false, reason: e.message || 'apply_error' };
  }
});

ipcMain.handle('switcher:clearPublicity', async () => {
  clearPublicityContent();
  return { ok: true };
});

ipcMain.handle('switcher:checkSquad', async () => {
  try {
    const squad = scanSquadFile();
    if (!squad) {
      return { ok: false, reason: 'no_squad' };
    }
    let applied = false;
    if (fs.existsSync(eaSettingsDir)) {
      const files = fs.readdirSync(eaSettingsDir).filter((f) => !f.startsWith('.'));
      const target = squad.name.toLowerCase();
      applied = files.some((f) => f.toLowerCase() === target);
    }
    return {
      ok: true,
      applied,
      fileName: squad.name,
      targetDir: eaSettingsDir
    };
  } catch (e) {
    console.error('Error en switcher:checkSquad:', e);
    return { ok: false, reason: e.message || 'check_error' };
  }
});

ipcMain.handle('switcher:applySquad', async () => {
  try {
    const squad = scanSquadFile();
    if (!squad) {
      return { ok: false, reason: 'no_squad' };
    }
    ensureDirExists(eaSettingsDir);
    const targetPath = path.join(eaSettingsDir, squad.name);
    fs.copyFileSync(squad.fullPath, targetPath);
    return { ok: true, fileName: squad.name, targetDir: eaSettingsDir };
  } catch (e) {
    console.error('Error en switcher:applySquad:', e);
    return { ok: false, reason: e.message || 'apply_error' };
  }
});

ipcMain.handle('teams:getStatus', async () => {
  try {
    const present = fs.existsSync(teamsTargetPath);
    return { ok: true, present };
  } catch (e) {
    console.error('Error en teams:getStatus:', e);
    return { ok: false, present: false, reason: e.message || 'status_error' };
  }
});

// Buscar carpeta del Live Editor (nombre puede ser liveEditor, FC 26 LE v26.2.5 (1), FC 26 Live Editor, etc.)
// Ruta típica: .../liveEditor/FC 26 LE v26.2.5 (1)/Launcher.exe
function findLiveEditorLauncherPath() {
  const baseDir = app.isPackaged ? process.resourcesPath : __dirname;
  const launcherName = 'Launcher.exe';
  const nameMatches = (name) => {
    const n = (name || '').toLowerCase();
    return n === 'liveeditor' ||
      n.includes('fc 26 le') ||
      n.includes('fc 26 live editor') ||
      (n.includes('live') && n.includes('editor'));
  };

  const searchDirs = [
    baseDir,
    path.join(baseDir, '..'),
    path.join(baseDir, '..', '..')
  ];
  if (process.platform === 'win32') {
    searchDirs.push('C:\\');
    const userProfile = process.env.USERPROFILE;
    if (userProfile) {
      searchDirs.push(path.join(userProfile, 'Documents'));
      searchDirs.push(path.join(userProfile, 'Desktop'));
      searchDirs.push(path.join(userProfile, 'Downloads'));
    }
  }

  for (const root of searchDirs) {
    try {
      if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) continue;
      const entries = fs.readdirSync(root, { withFileTypes: true });
      for (const ent of entries) {
        if (!ent.isDirectory()) continue;
        if (!nameMatches(ent.name)) continue;
        const parentPath = path.join(root, ent.name);
        const directPath = path.join(parentPath, launcherName);
        if (fs.existsSync(directPath)) return directPath;
        try {
          const subEntries = fs.readdirSync(parentPath, { withFileTypes: true });
          for (const sub of subEntries) {
            if (!sub.isDirectory()) continue;
            const nestedPath = path.join(parentPath, sub.name, launcherName);
            if (fs.existsSync(nestedPath)) return nestedPath;
          }
        } catch (_) {}
      }
    } catch (_) {}
  }
  return null;
}

ipcMain.handle('launcher:launch', async () => {
  try {
    const exePath = findLiveEditorLauncherPath();
    if (!exePath) {
      return { ok: false, reason: 'not_found', path: null };
    }
    return await new Promise((resolve) => {
      const quotedPath = exePath.includes(' ') ? `"${exePath.replace(/"/g, '""')}"` : exePath;
      const child = spawn(quotedPath, [], {
        shell: true,
        detached: true,
        stdio: 'ignore',
        cwd: path.dirname(exePath)
      });
      let settled = false;
      const done = (result) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      child.once('error', (err) => {
        console.error('Error al lanzar Launcher.exe:', err);
        done({ ok: false, reason: err?.code || err?.message || 'launch_error', path: exePath });
      });
      child.once('spawn', () => {
        try { child.unref(); } catch (_) {}
        done({ ok: true, path: exePath });
      });
    });
  } catch (e) {
    console.error('Error al lanzar Launcher.exe:', e);
    return { ok: false, reason: e?.message || 'launch_error', path: null };
  }
});

ipcMain.handle('modmanager:launch', async () => {
  try {
    // En desarrollo: __dirname. En instalador: extraResources está en process.resourcesPath (fuera del .asar)
    const baseDir = app.isPackaged ? process.resourcesPath : __dirname;
    const exePath = path.join(baseDir, 'modManager', 'FIFA Mod Manager.exe');
    if (!fs.existsSync(exePath)) {
      console.error('FIFA Mod Manager.exe no encontrado en:', exePath);
      return { ok: false, reason: 'not_found', path: exePath };
    }

    return await new Promise((resolve) => {
      // Usar shell: true en Windows para que el .exe se ejecute correctamente (evita EACCES con rutas con espacios)
      const quotedPath = exePath.includes(' ') ? `"${exePath.replace(/"/g, '""')}"` : exePath;
      const child = spawn(quotedPath, [], {
        shell: true,
        detached: true,
        stdio: 'ignore'
      });

      let settled = false;
      const done = (result) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };

      child.once('error', (err) => {
        console.error('Error al lanzar FIFA Mod Manager:', err);
        done({
          ok: false,
          reason: err && (err.code || err.message) ? (err.code || err.message) : 'launch_error'
        });
      });

      child.once('spawn', () => {
        try {
          child.unref();
        } catch (_) {}
        done({ ok: true });
      });
    });
  } catch (e) {
    console.error('Error al preparar el lanzamiento de FIFA Mod Manager:', e);
    return { ok: false, reason: e.message || 'launch_error' };
  }
});

// Auto-actualización (solo en app empaquetada)
ipcMain.handle('update:check', async () => {
  if (!autoUpdater) return { ok: false, reason: 'unavailable' };
  try {
    const result = await autoUpdater.checkForUpdates();
    return { ok: true, hasUpdate: !!result?.updateInfo };
  } catch (e) {
    return { ok: false, reason: e?.message || String(e) };
  }
});
ipcMain.on('update:quitAndInstall', () => {
  if (autoUpdater) autoUpdater.quitAndInstall(false, true);
});
ipcMain.handle('app:getVersion', () => app.getVersion());

// Devolver la config cargada al arranque (evita require en el handler por si falla en el instalador)
ipcMain.handle('app:getConfig', () => Promise.resolve(sharedAppConfig || {}));

// Peticiones al bot: main añade secreto + token de sesión (el renderer nunca recibe el secreto)
ipcMain.handle('bot:setSessionUser', (_event, email) => {
  sessionEmail = typeof email === 'string' && email.trim() ? email.trim() : null;
  sessionExpiry = sessionEmail ? Date.now() + SESSION_TTL_MS : 0;
  return Promise.resolve();
});
ipcMain.handle('bot:clearSessionUser', () => {
  sessionEmail = null;
  sessionExpiry = 0;
  return Promise.resolve();
});
ipcMain.handle('bot:fetch', async (_event, url, options) => {
  if (typeof url !== 'string' || !url.startsWith('http')) {
    return { ok: false, status: 0, statusText: 'Invalid URL', body: '' };
  }
  const secret = (sharedAppConfig && sharedAppConfig.botSharedSecret) ? String(sharedAppConfig.botSharedSecret).trim() : '';
  const headers = { ...(options && options.headers) };
  if (secret) headers['X-Auth2027-Secret'] = secret;
  if (sessionEmail && sessionExpiry > Date.now()) {
    const token = createSessionToken(sessionEmail);
    if (token) headers['X-Auth2027-Session'] = token;
  }
  try {
    const res = await fetch(url, { ...options, headers });
    const body = await res.text();
    return { ok: res.ok, status: res.status, statusText: res.statusText, body };
  } catch (err) {
    return { ok: false, status: 0, statusText: err && err.message ? err.message : 'Network error', body: '' };
  }
});

// Limpiar caché: borrar carpetas de FIFA Editor Tool, FIFA_Editor_Tool, FIFA Mod Manager y FC 26
ipcMain.handle('app:clearCache', async () => {
  const home = os.homedir && typeof os.homedir === 'function' ? os.homedir() : process.env.USERPROFILE || '';
  const programFilesX86 = process.env['ProgramFiles(X86)'] || path.join('C:', 'Program Files (x86)');
  const dirs = [
    path.join(home, 'AppData', 'Local', 'FIFA Editor Tool'),
    path.join(home, 'AppData', 'Local', 'FIFA_Editor_Tool'),
    path.join(home, 'AppData', 'Local', 'FIFA_Mod_Manager'),
    path.join(programFilesX86, 'Steam', 'steamapps', 'common', 'FC 26')
  ];
  const errors = [];
  for (const dir of dirs) {
    try {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true, maxRetries: 2 });
      }
    } catch (e) {
      errors.push(dir + ': ' + (e && e.message ? e.message : String(e)));
    }
  }
  if (errors.length > 0) {
    return { ok: false, message: errors.join('; ') };
  }
  return { ok: true };
});

// En desarrollo (npm run electron) usar el manifest local; en app empaquetada el renderer usa GitHub
ipcMain.handle('mods:getManifest', () => {
  if (app.isPackaged) return Promise.resolve(null);
  try {
    const p = path.join(__dirname, 'mods-manifest.json');
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, 'utf8'));
      return Promise.resolve(data && typeof data === 'object' ? data : null);
    }
  } catch (_) {}
  return Promise.resolve(null);
});

ipcMain.handle('shell:openExternal', (_event, url) => {
  if (typeof url !== 'string' || !url.startsWith('http')) return Promise.resolve({ ok: false });
  return shell.openExternal(url).then(() => ({ ok: true })).catch((e) => ({ ok: false, error: e?.message }));
});

// Quitar caracteres de control en cabeceras/URL (evita "Invalid header value char")
function safeHeaderValue(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[\x00-\x1F\x7F]/g, '').trim();
}

function isGoogleDriveUrl(u) {
  return typeof u === 'string' && u.includes('drive.google.com') && (u.includes('/uc?') || u.includes('export=download') || u.includes('/file/d/'));
}

// Normaliza cualquier enlace de Drive (view, uc?export=download) a formato de descarga para que se trate como Drive
function normalizeDriveUrl(u) {
  if (typeof u !== 'string') return u;
  if (u.includes('drive.google.com')) {
    const id = extractDriveFileId(u);
    if (!id) return u;
    return `https://drive.google.com/uc?export=download&id=${id}`;
  }
  // Dropbox: forzar descarga directa (?dl=1) para evitar recibir la página en vez del archivo
  if (u.includes('dropbox.com') && !u.includes('dl=1')) {
    return u.includes('?') ? u.replace(/\bdl=0\b/, 'dl=1') : u + '?dl=1';
  }
  return u;
}

const LARGE_FILE_THRESHOLD = 25 * 1024 * 1024; // 25 MB: si Content-Length > esto, es archivo binario, no HTML de aviso

function extractDriveConfirmToken(responseBody, setCookieHeader) {
  if (setCookieHeader) {
    const m = String(setCookieHeader).match(/download_warning[^=]*=([^;]+)/);
    if (m) return decodeURIComponent(m[1].trim());
  }
  if (responseBody && responseBody.length < 100000) {
    const body = typeof responseBody === 'string' ? responseBody : responseBody.toString('utf8');
    const m = body.match(/confirm=([0-9A-Za-z_-]+)/);
    if (m) return m[1];
  }
  return null;
}

function getDriveUserContentUrl(fileId) {
  return `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&confirm=t`;
}

function extractDriveFileId(u) {
  if (typeof u !== 'string') return null;
  const byId = u.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (byId) return byId[1];
  const byPath = u.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (byPath) return byPath[1];
  return null;
}

function parseContentDisposition(header) {
  if (!header) return null;
  const m = String(header).match(/filename\*?=(?:UTF-8'')?([^;]+)|filename=["']?([^"';]+)["']?/i);
  if (m) {
    const name = (m[1] || m[2] || '').trim().replace(/^["']|["']$/g, '');
    return decodeURIComponent(name) || null;
  }
  return null;
}

function safeBasename(name) {
  if (!name || typeof name !== 'string') return null;
  const base = path.basename(name.replace(/[/\\]/g, ''));
  return base.replace(/[^\w.\-()\s]/gi, '_').slice(0, 200) || null;
}

// Descarga automática de mods FC26: descarga el .zip desde url y lo extrae en modManager/Mods/FC26/
// Si se pasa un array de URLs (downloadUrls), descarga cada una como archivo directo en destDir (sin ZIP).
// Añade un parámetro único a la URL para forzar descarga real (evita 304 / caché del servidor o red)
function addCacheBust(url) {
  if (typeof url !== 'string') return url;
  const sep = url.includes('?') ? '&' : '?';
  return url + sep + '_t=' + Date.now() + '&_r=' + Math.random().toString(36).slice(2, 11);
}

ipcMain.handle('mods:download', async (event, urlOrOptions) => {
  // Compatibilidad hacia atrás:
  // - string  -> una URL (zip o fifamod único)
  // - array   -> varias URLs fifamod (borra carpeta antes de descargar)
  // Nuevo formato:
  // - { urls: [...], preserveExisting: true } -> varias URLs pero SIN borrar la carpeta existente
  let preserveExisting = false;
  let urlOrUrls = urlOrOptions;
  if (urlOrOptions && typeof urlOrOptions === 'object' && !Array.isArray(urlOrOptions)) {
    if (Array.isArray(urlOrOptions.urls)) {
      urlOrUrls = urlOrOptions.urls;
    }
    preserveExisting = !!urlOrOptions.preserveExisting;
  }

  const isMultiple = Array.isArray(urlOrUrls);
  let urls = isMultiple ? urlOrUrls.filter(u => u && String(u).startsWith('http')) : [urlOrUrls];
  urls = urls.map(u => normalizeDriveUrl(safeHeaderValue(String(u))));
  urls = urls.map(addCacheBust);
  if (urls.length === 0) return { ok: false, reason: 'invalid_url' };
  const singleUrl = !isMultiple && urls.length === 1 ? urls[0] : null;
  if (singleUrl && (!singleUrl.startsWith('http://') && !singleUrl.startsWith('https://'))) {
    return { ok: false, reason: 'invalid_url' };
  }
  // App empaquetada: descargar SIEMPRE en userData (tiene escritura). Luego copiamos a resources para el Mod Manager.
  const baseDir = app.isPackaged ? process.resourcesPath : __dirname;
  const destDir = app.isPackaged
    ? path.join(app.getPath('userData'), 'modManager', 'Mods', 'FC26')
    : path.join(baseDir, 'modManager', 'Mods', 'FC26');
  const resourcesModsDir = path.join(baseDir, 'modManager', 'Mods', 'FC26');
  const MIN_MOD_BYTES = 50 * 1024;
  const tempZip = path.join(os.tmpdir(), `auth2027-mods-${Date.now()}.zip`);
  const sendProgress = (data) => {
    try {
      if (event.sender && !event.sender.isDestroyed()) event.sender.send('mods-download-progress', data);
    } catch (_) {}
  };
  // Usar SOLO https/http de Node (cero Chromium): la descarga NUNCA pasa por caché. net y fetch en Electron pueden cachear.
  const doDownload = (downloadUrl, cookieHeader, outputPath) => {
    const out = outputPath || tempZip;
    const sep = downloadUrl.includes('?') ? '&' : '?';
    const finalUrl = downloadUrl + sep + '_t=' + Date.now() + '&_r=' + Math.random().toString(36).slice(2, 11);
    const urlObj = new URL(finalUrl);
    const isHttps = urlObj.protocol === 'https:';
    const lib = isHttps ? https : http;
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/zip,*/*',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    };
    if (cookieHeader) options.headers['Cookie'] = cookieHeader;

    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(out);
      const cleanup = () => { try { file.close(); } catch (_) {} if (out === tempZip) fs.unlink(out, () => {}); };

      const req = lib.request(options, (response) => {
        const status = response.statusCode || 0;
        if (status === 304) {
          cleanup();
          return reject(new Error('cached_304'));
        }
        if (status >= 301 && status <= 308 && response.headers.location) {
          cleanup();
          const nextUrl = new URL(response.headers.location, finalUrl).href;
          const setCookie = response.headers['set-cookie'];
          const newCookie = Array.isArray(setCookie) ? setCookie.join('; ') : (setCookie || cookieHeader || '');
          return doDownload(nextUrl, newCookie || cookieHeader, outputPath).then(resolve).catch(reject);
        }
        if (status < 200 || status >= 300) {
          cleanup();
          return reject(new Error('download_failed'));
        }
        const total = response.headers['content-length'] ? parseInt(response.headers['content-length'], 10) : null;
        let received = 0;
        response.on('data', (chunk) => {
          received += chunk.length;
          const percent = total ? Math.min(100, Math.round((received / total) * 100)) : null;
          sendProgress({ phase: 'download', percent, bytesReceived: received, totalBytes: total });
          if (!file.write(chunk)) response.pause();
        });
        file.on('drain', () => response.resume());
        response.on('end', () => {
          file.end();
        });
        response.on('error', (err) => { cleanup(); reject(err); });
        file.on('finish', () => resolve());
        file.on('error', (err) => { cleanup(); reject(err); });
      });
      req.on('error', (err) => {
        cleanup();
        reject(err);
      });
      // Aumentar timeout a 10 minutos para conexiones lentas o archivos muy grandes
      req.setTimeout(600000, () => { req.destroy(); cleanup(); reject(new Error('timeout')); });
      req.end();
    });
  };

  // Sonda a Google Drive usando SOLO https/http de Node (sin Chromium) para evitar respuestas cacheadas (ej. 2KB HTML).
  const driveProbeWithHttps = (probeUrl, opts, cookieHeader) => {
    const urlObj = new URL(probeUrl);
    const isHttps = urlObj.protocol === 'https:';
    const lib = isHttps ? https : http;
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/octet-stream,*/*',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    };
    if (cookieHeader) options.headers['Cookie'] = cookieHeader;

    return new Promise((resolve, reject) => {
      const req = lib.request(options, (response) => {
        const status = response.statusCode || 0;
        if (status >= 301 && status <= 308 && response.headers.location) {
          const nextUrl = new URL(response.headers.location, probeUrl).href;
          const setCookie = response.headers['set-cookie'];
          const newCookie = Array.isArray(setCookie) ? setCookie.join('; ') : (setCookie || cookieHeader || '');
          return driveProbeWithHttps(nextUrl, opts, newCookie || cookieHeader).then(resolve).catch(reject);
        }
        if (status < 200 || status >= 300) {
          return resolve({ action: 'retry', token: null, cookie: null });
        }
        const cd = response.headers['content-disposition'];
        const name = safeBasename(parseContentDisposition(cd)) || opts.defaultName;
        const outputPath = opts.isSingleZip ? opts.tempZipPath : path.join(opts.destDir, name);
        const cookieStr = Array.isArray(response.headers['set-cookie']) ? response.headers['set-cookie'].join('; ') : (response.headers['set-cookie'] || '');
        const total = response.headers['content-length'] ? parseInt(response.headers['content-length'], 10) : null;
        const MAX_HTML_SIZE = 5 * 1024 * 1024;
        let pending = [];
        let pendingLen = 0;
        const htmlChunks = [];
        let fileStream = null;
        let received = 0;
        let decided = false;
        if (total !== null && total > LARGE_FILE_THRESHOLD) {
          fileStream = fs.createWriteStream(outputPath);
          decided = true;
        }
        function peek2() {
          if (pending.length === 0 || pendingLen < 2) return null;
          if (pending[0].length >= 2) return [pending[0][0], pending[0][1]];
          if (pending[0].length === 1 && pending.length > 1) return [pending[0][0], pending[1][0]];
          return null;
        }
        response.on('data', (chunk) => {
          if (!decided) {
            pending.push(chunk);
            pendingLen += chunk.length;
            if (pendingLen >= 2) {
              const two = peek2();
              decided = true;
              if (two && two[0] === 0x50 && two[1] === 0x4b) {
                fileStream = fs.createWriteStream(outputPath);
                for (const c of pending) {
                  fileStream.write(c);
                  received += c.length;
                  if (opts.sendProgress) opts.sendProgress({ phase: 'download', fileIndex: opts.fileIndex, totalFiles: opts.totalFiles, percent: total ? Math.min(100, Math.round((received / total) * 100)) : null, bytesReceived: received, totalBytes: total });
                }
                pending = [];
                pendingLen = 0;
              } else {
                if (pendingLen > MAX_HTML_SIZE) {
                  response.destroy();
                  return resolve({ action: 'retry', token: null, cookie: null });
                }
                for (const c of pending) htmlChunks.push(c);
                pending = [];
                pendingLen = 0;
              }
            }
            return;
          }
          if (fileStream) {
            received += chunk.length;
            if (opts.sendProgress) opts.sendProgress({ phase: 'download', fileIndex: opts.fileIndex, totalFiles: opts.totalFiles, percent: total ? Math.min(100, Math.round((received / total) * 100)) : null, bytesReceived: received, totalBytes: total });
            fileStream.write(chunk);
          } else {
            let htmlSize = 0;
            for (const c of htmlChunks) htmlSize += c.length;
            if (htmlSize + chunk.length > MAX_HTML_SIZE) {
              response.destroy();
              return resolve({ action: 'retry', token: null, cookie: null });
            }
            htmlChunks.push(chunk);
          }
        });
        response.on('end', () => {
          if (fileStream) {
            fileStream.end();
            fileStream.on('finish', () => resolve({ action: 'done', outputPath }));
            fileStream.on('error', () => resolve({ action: 'retry', token: null, cookie: null }));
            return;
          }
          if (!decided && pendingLen > 0) {
            if (pendingLen > MAX_HTML_SIZE) {
              return resolve({ action: 'retry', token: null, cookie: null });
            }
            const buf = Buffer.concat(pending);
            if (buf.length >= 2 && buf[0] === 0x50 && buf[1] === 0x4b) {
              fs.writeFileSync(outputPath, buf);
              return resolve({ action: 'done', outputPath });
            }
            htmlChunks.push(buf);
          }
          const totalHtml = htmlChunks.reduce((a, c) => a + c.length, 0);
          if (totalHtml > MAX_HTML_SIZE) {
            return resolve({ action: 'retry', token: null, cookie: null });
          }
          const body = Buffer.concat(htmlChunks).toString('utf8');
          const token = extractDriveConfirmToken(body, cookieStr);
          resolve({ action: 'retry', token, cookie: cookieStr || null, outputPath });
        });
        response.on('error', () => {
          if (fileStream) fileStream.destroy();
          resolve({ action: 'retry', token: null, cookie: null });
        });
      });
      req.on('error', () => resolve({ action: 'retry', token: null, cookie: null }));
      req.setTimeout(60000, () => { req.destroy(); resolve({ action: 'retry', token: null, cookie: null }); });
      req.end();
    });
  };

  try {
    // Borrado completo de carpeta solo cuando NO se indica preserveExisting.
    // Para descargas individuales (modo "añadir un archivo") usamos preserveExisting = true.
    if (!preserveExisting) {
      if (fs.existsSync(destDir)) {
        try {
          fs.rmSync(destDir, { recursive: true, force: true, maxRetries: 3 });
        } catch (e) {
          return {
            ok: false,
            reason: 'no_se_pudo_borrar_carpeta_mods',
            message:
              'No se pudo vaciar la carpeta de mods (permisos?). Prueba ejecutar la app como administrador o reinstalar en una carpeta donde tengas escritura.'
          };
        }
      }
      fs.mkdirSync(destDir, { recursive: true });
      const remaining = fs.readdirSync(destDir).length;
      if (remaining > 0) {
        return {
          ok: false,
          reason: 'carpeta_mods_no_quedo_vacia',
          message:
            'La carpeta de mods no se pudo vaciar. Reinstala la app en una carpeta con permisos de escritura (ej. Documentos) o ejecútala como administrador.'
        };
      }
    } else {
      // En modo "preserveExisting" solo nos aseguramos de que la carpeta exista.
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
    }

    // Limpiar zips temporales de descargas anteriores
    try {
      const tmpDir = os.tmpdir();
      const tmpEntries = fs.readdirSync(tmpDir, { withFileTypes: true });
      for (const e of tmpEntries) {
        if (e.isFile() && e.name.startsWith('auth2027-mods-') && e.name.endsWith('.zip')) {
          try { fs.unlinkSync(path.join(tmpDir, e.name)); } catch (_) {}
        }
      }
    } catch (_) {}

    // Múltiples URLs: descarga cada una directamente a destDir (sin ZIP)
    if (isMultiple) {
      for (let i = 0; i < urls.length; i++) {
        const url = safeHeaderValue(String(urls[i]));
        if (!url.startsWith('http')) continue;
        sendProgress({ phase: 'download', fileIndex: i + 1, totalFiles: urls.length, percent: 0, bytesReceived: 0, totalBytes: null });
        // Nombre por defecto:
        // - Descarga completa (preserveExisting === false): mod_1.fifamod, mod_2.fifamod, ...
        // - Descarga individual (preserveExisting === true): usar el nombre real del archivo de la URL
        let defaultName;
        if (preserveExisting) {
          try {
            const u = new URL(url);
            const last = path.basename(u.pathname) || '';
            defaultName = last.trim() || `mod_${i + 1}.fifamod`;
          } catch (_) {
            defaultName = `mod_${i + 1}.fifamod`;
          }
        } else {
          defaultName = `mod_${i + 1}.fifamod`;
        }
        let outputPath = null;
        const defaultOutputPath = path.join(destDir, defaultName);
        let fileOk = false;
        const maxAttempts = 3;
        for (let attempt = 0; attempt < maxAttempts && !fileOk; attempt++) {
          if (attempt > 0) {
            await new Promise((r) => setTimeout(r, 2500));
            sendProgress({ phase: 'download', fileIndex: i + 1, totalFiles: urls.length, percent: 0, bytesReceived: 0, totalBytes: null });
          }
        if (isGoogleDriveUrl(url)) {
          const driveProbeUrl = url + (url.includes('?') ? '&' : '?') + '_n=' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
          const driveResult = await driveProbeWithHttps(driveProbeUrl, {
            destDir,
            defaultName,
            isSingleZip: false,
            sendProgress,
            fileIndex: i + 1,
            totalFiles: urls.length
          });
          if (driveResult.action === 'done') {
            outputPath = driveResult.outputPath;
          } else if (driveResult.token) {
            outputPath = driveResult.outputPath || defaultOutputPath;
            const sep = url.includes('?') ? '&' : '?';
            await doDownload(url + sep + 'confirm=' + encodeURIComponent(driveResult.token), driveResult.cookie, outputPath);
          } else {
            const fileId = extractDriveFileId(url);
            const fallbackUrl = fileId ? getDriveUserContentUrl(fileId) : url;
            await doDownload(fallbackUrl, undefined, outputPath);
          }
        } else {
          await doDownload(url, undefined, defaultOutputPath);
        }
        const writtenPath = outputPath || defaultOutputPath;
        if (fs.existsSync(writtenPath)) {
          const size = fs.statSync(writtenPath).size;
          if (size >= MIN_MOD_BYTES) {
            fileOk = true;
          } else {
            try { fs.unlinkSync(writtenPath); } catch (_) {}
            if (attempt === maxAttempts - 1) {
              return { ok: false, reason: 'archivo_demasiado_pequeno', message: `El archivo ${i + 1} sigue llegando con ${size} bytes tras ${maxAttempts} intentos (Google Drive puede estar limitando). Prueba más tarde o usa otro enlace.` };
            }
          }
        }
        }
        sendProgress({ phase: 'file_done', fileIndex: i + 1, totalFiles: urls.length });
      }
      if (app.isPackaged) {
        try {
          if (fs.existsSync(resourcesModsDir)) fs.rmSync(resourcesModsDir, { recursive: true, force: true });
          fs.mkdirSync(resourcesModsDir, { recursive: true });
          const files = fs.readdirSync(destDir, { withFileTypes: true });
          for (const f of files) {
            const src = path.join(destDir, f.name);
            const dest = path.join(resourcesModsDir, f.name);
            if (f.isDirectory()) copyDirRecursive(src, dest);
            else fs.copyFileSync(src, dest);
          }
        } catch (copyErr) {
          return { ok: true, path: destDir, copyFailed: true, message: 'Mods descargados en ' + destDir + ' pero no se pudieron copiar al Mod Manager (permisos). Copia la carpeta manualmente o reinstala la app fuera de Program Files.' };
        }
      }
      return { ok: true, path: destDir };
    }

    sendProgress({ phase: 'download', percent: 0, bytesReceived: 0, totalBytes: null });
    let singleZipOk = false;
    const singleMaxAttempts = 3;
    for (let attempt = 0; attempt < singleMaxAttempts && !singleZipOk; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 2500));
        sendProgress({ phase: 'download', percent: 0, bytesReceived: 0, totalBytes: null });
      }
    if (isGoogleDriveUrl(singleUrl)) {
      const singleProbeUrl = singleUrl + (singleUrl.includes('?') ? '&' : '?') + '_n=' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
      const driveResult = await driveProbeWithHttps(singleProbeUrl, {
        destDir,
        defaultName: 'mod_1.fifamod',
        tempZipPath: tempZip,
        isSingleZip: true,
        sendProgress,
        fileIndex: 1,
        totalFiles: 1
      });
      if (driveResult.action === 'done') {
        // ya escrito en tempZip
      } else if (driveResult.token) {
        const sep = singleUrl.includes('?') ? '&' : '?';
        const urlWithConfirm = singleUrl + sep + 'confirm=' + encodeURIComponent(driveResult.token);
        await doDownload(urlWithConfirm, driveResult.cookie || undefined);
      } else {
        const fileId = extractDriveFileId(singleUrl);
        const fallbackUrl = fileId ? getDriveUserContentUrl(fileId) : singleUrl;
        await doDownload(fallbackUrl);
      }
    } else {
      await doDownload(singleUrl);
    }
    if (fs.existsSync(tempZip) && fs.statSync(tempZip).size >= MIN_MOD_BYTES) {
      singleZipOk = true;
    } else {
      try { if (fs.existsSync(tempZip)) fs.unlinkSync(tempZip); } catch (_) {}
      if (attempt === singleMaxAttempts - 1) {
        return { ok: false, reason: 'archivo_demasiado_pequeno', message: 'El archivo sigue llegando muy pequeño tras ' + singleMaxAttempts + ' intentos (Google Drive puede estar limitando). Prueba más tarde o usa otro enlace.' };
      }
    }
    }
    if (!singleZipOk) return { ok: false, reason: 'archivo_demasiado_pequeno', message: 'No se pudo descargar el archivo.' };
    sendProgress({ phase: 'file_done', fileIndex: 1, totalFiles: 1 });
    const fd = fs.openSync(tempZip, 'r');
    const zipHeader = Buffer.alloc(4);
    fs.readSync(fd, zipHeader, 0, 4, 0);
    fs.closeSync(fd);
    if (zipHeader[0] !== 0x50 || zipHeader[1] !== 0x4b) {
      // Archivo no es ZIP (ej. .fifamod): guardarlo en destDir como mod único
      const destFile = path.join(destDir, 'mod_1.fifamod');
      try {
        fs.renameSync(tempZip, destFile);
      } catch (e) {
        try { fs.copyFileSync(tempZip, destFile); fs.unlinkSync(tempZip); } catch (_) {}
      }
      sendProgress({ phase: 'extract', percent: 100 });
      return { ok: true, path: destDir };
    }
    sendProgress({ phase: 'extract', percent: 0 });
    const zipSize = fs.statSync(tempZip).size;
    const usePowerShell = process.platform === 'win32' && zipSize > 1024 * 1024 * 1024; // > 1 GB: extraer con PowerShell para no saturar RAM
    if (usePowerShell) {
      await new Promise((resolve, reject) => {
        const ps = spawn('powershell', [
          '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
          `Expand-Archive -LiteralPath '${tempZip.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`
        ], { stdio: 'ignore', windowsHide: true });
        ps.on('close', (code) => code === 0 ? resolve() : reject(new Error('Expand-Archive failed: ' + code)));
        ps.on('error', reject);
      });
    } else {
      const directory = await unzipper.Open.file(tempZip);
      await directory.extract({ path: destDir });
    }
    const entries = fs.readdirSync(destDir, { withFileTypes: true });
    if (entries.length === 1 && entries[0].isDirectory()) {
      const singleDir = path.join(destDir, entries[0].name);
      const inner = fs.readdirSync(singleDir, { withFileTypes: true });
      for (const e of inner) {
        const src = path.join(singleDir, e.name);
        const dest = path.join(destDir, e.name);
        fs.renameSync(src, dest);
      }
      fs.rmdirSync(singleDir);
    }
    sendProgress({ phase: 'extract', percent: 100 });
    try { fs.unlinkSync(tempZip); } catch (_) {}
    if (app.isPackaged) {
      try {
        if (fs.existsSync(resourcesModsDir)) fs.rmSync(resourcesModsDir, { recursive: true, force: true });
        fs.mkdirSync(resourcesModsDir, { recursive: true });
        const files = fs.readdirSync(destDir, { withFileTypes: true });
        for (const f of files) {
          const src = path.join(destDir, f.name);
          const dest = path.join(resourcesModsDir, f.name);
          if (f.isDirectory()) copyDirRecursive(src, dest);
          else fs.copyFileSync(src, dest);
        }
      } catch (copyErr) {
        return { ok: true, path: destDir, copyFailed: true, message: 'Mods descargados en ' + destDir + ' pero no se pudieron copiar al Mod Manager. Copia la carpeta manualmente o reinstala fuera de Program Files.' };
      }
    }
    return { ok: true, path: destDir };
  } catch (e) {
    try { if (fs.existsSync(tempZip)) fs.unlinkSync(tempZip); } catch (_) {}
    const msg = e?.message || 'download_error';
    const code = e?.code || '';
    const reason = msg === 'cached_304' ? 'caché_304' : msg;
    let friendlyMessage = e?.message || 'Error al descargar.';
    if (msg === 'cached_304') {
      friendlyMessage = 'El servidor devolvió caché (304). Intenta de nuevo en unos segundos.';
    } else if (msg === 'timeout') {
      friendlyMessage = 'La descarga tardó demasiado y se interrumpió (timeout). Revisa tu conexión o inténtalo de nuevo más tarde.';
    } else if (code === 'ECONNRESET' || msg.includes('ECONNRESET')) {
      friendlyMessage = 'La conexión se cortó mientras se descargaba (ECONNRESET). Suele pasar con archivos grandes o red inestable. Vuelve a intentar; si falla, prueba descargar los archivos de uno en uno.';
    } else if (code === 'ETIMEDOUT' || code === 'ECONNREFUSED' || msg.includes('ETIMEDOUT') || msg.includes('ECONNREFUSED')) {
      friendlyMessage = 'No se pudo conectar al servidor. Revisa tu Internet e inténtalo de nuevo.';
    }
    return { ok: false, reason, message: friendlyMessage };
  }
});
