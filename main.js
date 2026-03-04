const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
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
// Cargar config aquí (main se ejecuta desde la carpeta de la app) y pasarla al preload vía env
try {
  const config = require('./config.js');
  if (config) {
    process.env.AUTH_APP_BASE_URL = (config.API_BASE_URL != null) ? String(config.API_BASE_URL).trim() : '';
    process.env.AUTH_APP_AUTH_ENDPOINT = (config.AUTH_ENDPOINT != null) ? String(config.AUTH_ENDPOINT).trim() : '';
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

function removeOverlayFileByPrefix(prefix) {
  try {
    const targetDir = overlayTargetDir;
    if (!fs.existsSync(targetDir)) return { ok: true };
    const entries = fs.readdirSync(targetDir, { withFileTypes: true });
    const targetLower = String(prefix || '').toLowerCase();
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const nameLower = entry.name.toLowerCase();
      if (!targetLower || !nameLower.startsWith(targetLower)) continue;
      const fullPath = path.join(targetDir, entry.name);
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
  clearOverlayTargetDir();
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
  clearOverlayTargetDir();
  mainWindow?.close();
});

// Control desde el renderer del acceso al archivo fifa_ng_db.DB
ipcMain.handle('game-db:set', async (_event, enabled) => {
  if (enabled) {
    return ensureGameDbPresent();
  }
  return removeGameDbIfExists();
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
