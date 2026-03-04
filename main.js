const { app, BrowserWindow, ipcMain, screen, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const unzipper = require('unzipper');
require('dotenv').config();

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
let sharedAppConfig = {};
try {
  const config = require('./config.js');
  if (config) {
    process.env.AUTH_APP_BASE_URL = (config.API_BASE_URL != null) ? String(config.API_BASE_URL).trim() : '';
    process.env.AUTH_APP_AUTH_ENDPOINT = (config.AUTH_ENDPOINT != null) ? String(config.AUTH_ENDPOINT).trim() : '';
    sharedAppConfig = {
      baseUrl: (config.API_BASE_URL != null) ? String(config.API_BASE_URL).trim() : '',
      authEndpoint: (config.AUTH_ENDPOINT != null) ? String(config.AUTH_ENDPOINT).trim() : '',
      discordOAuthBaseUrl: (config.DISCORD_OAUTH_BASE_URL != null) ? String(config.DISCORD_OAUTH_BASE_URL).trim() : '',
      pcName: (process.env.AUTH_APP_PC_NAME != null) ? String(process.env.AUTH_APP_PC_NAME).trim() : (os.hostname ? os.hostname() : ''),
      botSharedSecret: (config.BOT_SHARED_SECRET != null) ? String(config.BOT_SHARED_SECRET).trim() : ''
    };
  }
} catch (_) {}

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

      // Archivos de config
      let layoutPath = null;
      const layoutUpper = path.join(pBase, 'fchubcfg.XML');
      const layoutLower = path.join(pBase, 'fchubcfg.xml');
      if (fs.existsSync(layoutUpper)) layoutPath = layoutUpper;
      else if (fs.existsSync(layoutLower)) layoutPath = layoutLower;

      let themesPath = null;
      const fifaUpper = path.join(pBase, 'FIFA.XML');
      const fifaLower = path.join(pBase, 'fifa.xml');
      if (fs.existsSync(fifaUpper)) themesPath = fifaUpper;
      else if (fs.existsSync(fifaLower)) themesPath = fifaLower;

      // Adboards
      let adboardsDir = null;
      const adLocal = path.join(pBase, 'adboards');
      if (fs.existsSync(adLocal)) adboardsDir = adLocal;

      // Fondo fchub
      let fondoPath = null;
      const fondoDir = path.join(pBase, 'fondo');
      if (fs.existsSync(fondoDir)) {
        const fondoFiles = fs.readdirSync(fondoDir, { withFileTypes: true });
        for (const f of fondoFiles) {
          if (!f.isFile()) continue;
          const lower = f.name.toLowerCase();
          if (lower.startsWith('backgroundletterc') && lower.endsWith('.dds')) {
            fondoPath = path.join(fondoDir, f.name);
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
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  const mainWindowOptions = {
    width,
    height,
    minWidth: width,
    minHeight: height,
    resizable: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0d0d12',
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

    // Layout
    if (pub.layoutPath) {
      try {
        ensureDirExists(layoutTargetDir);
        const targetPath = path.join(layoutTargetDir, path.basename(pub.layoutPath));
        fs.copyFileSync(pub.layoutPath, targetPath);
      } catch (e) {
        console.error('Error al copiar fchubcfg.XML:', e);
      }
    }

    // Themes
    if (pub.themesPath) {
      try {
        ensureDirExists(themesTargetDir);
        const targetPath = path.join(themesTargetDir, path.basename(pub.themesPath));
        fs.copyFileSync(pub.themesPath, targetPath);
      } catch (e) {
        console.error('Error al copiar FIFA.XML:', e);
      }
    }

    // Adboards
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

    // Fondo fchub
    removeFilesByPrefix(fchubTargetDir, 'backgroundletterc');
    if (pub.fondoPath) {
      try {
        ensureDirExists(fchubTargetDir);
        const targetPath = path.join(fchubTargetDir, path.basename(pub.fondoPath));
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

ipcMain.handle('shell:openExternal', (_event, url) => {
  if (typeof url !== 'string' || !url.startsWith('http')) return Promise.resolve({ ok: false });
  return shell.openExternal(url).then(() => ({ ok: true })).catch((e) => ({ ok: false, error: e?.message }));
});

// Descarga automática de mods FC26: descarga el .zip desde url y lo extrae en modManager/Mods/FC26/
ipcMain.handle('mods:download', async (event, url) => {
  if (typeof url !== 'string' || (!url.startsWith('http://') && !url.startsWith('https://'))) {
    return { ok: false, reason: 'invalid_url' };
  }
  const baseDir = app.isPackaged ? process.resourcesPath : __dirname;
  const destDir = path.join(baseDir, 'modManager', 'Mods', 'FC26');
  const tempZip = path.join(os.tmpdir(), `auth2027-mods-${Date.now()}.zip`);
  const sendProgress = (data) => {
    try {
      if (event.sender && !event.sender.isDestroyed()) event.sender.send('mods-download-progress', data);
    } catch (_) {}
  };
  try {
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    sendProgress({ phase: 'download', percent: 0, bytesReceived: 0, totalBytes: null });
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) return { ok: false, reason: 'download_failed', status: res.status };
    const totalBytes = res.headers.get('content-length');
    const total = totalBytes ? parseInt(totalBytes, 10) : null;
    const file = fs.createWriteStream(tempZip);
    const reader = res.body.getReader();
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      file.write(Buffer.from(value));
      received += value.length;
      const percent = total ? Math.min(100, Math.round((received / total) * 100)) : null;
      sendProgress({ phase: 'download', percent, bytesReceived: received, totalBytes: total });
    }
    file.end();
    await new Promise((resolve, reject) => {
      file.on('finish', resolve);
      file.on('error', reject);
    });
    sendProgress({ phase: 'extract', percent: 0 });
    await new Promise((resolve, reject) => {
      fs.createReadStream(tempZip)
        .pipe(unzipper.Extract({ path: destDir }))
        .on('close', () => resolve())
        .on('error', reject);
    });
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
    return { ok: true, path: destDir };
  } catch (e) {
    try { if (fs.existsSync(tempZip)) fs.unlinkSync(tempZip); } catch (_) {}
    return { ok: false, reason: e?.message || 'download_error' };
  }
});
