const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

app.commandLine.appendSwitch('js-flags', '--max-old-space-size=64');
app.commandLine.appendSwitch('disable-features', [
  'AutofillServerCommunication',
  'AudioServiceOutOfProcess',
  'BackForwardCache',
  'CalculateNativeWinOcclusion',
  'InterestFeedContentSuggestions',
  'MediaRouter',
  'OptimizationHints',
  'Translate'
].join(','));
app.commandLine.appendSwitch('enable-features', 'NetworkServiceInProcess');
app.commandLine.appendSwitch('disable-component-update');
app.commandLine.appendSwitch('disable-domain-reliability');

let mainWindow;
const dragState = new Map();
const iconPath = path.join(__dirname, 'build', 'icon.ico');

function applyGlassSettings(win, settings = {}) {
  if (!win || win.isDestroyed()) return;
  const blur = Number(settings.blur ?? 24);

  win.setBackgroundColor('#00000000');

  if (process.platform === 'win32' && typeof win.setBackgroundMaterial === 'function') {
    try {
      win.setBackgroundMaterial('none');
    } catch (error) {
      console.warn('Unable to set Windows background material:', error.message);
    }
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 980,
    minHeight: 640,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    icon: iconPath,
    title: 'Wavely',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      devTools: false,
      spellcheck: false,
      backgroundThrottling: true
    }
  });

  applyGlassSettings(mainWindow);
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('window-control', (event, action) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  if (action === 'minimize') win.minimize();
  if (action === 'maximize') {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  }
  if (action === 'close') win.close();
});

ipcMain.handle('is-window-maximized', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return !!win?.isMaximized();
});

ipcMain.handle('window-drag-start', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed() || win.isMaximized()) return;
  const cursor = screen.getCursorScreenPoint();
  const bounds = win.getBounds();
  dragState.set(event.sender.id, {
    offsetX: cursor.x - bounds.x,
    offsetY: cursor.y - bounds.y
  });
});

ipcMain.handle('window-drag-move', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const state = dragState.get(event.sender.id);
  if (!win || win.isDestroyed() || !state) return;
  const cursor = screen.getCursorScreenPoint();
  win.setPosition(cursor.x - state.offsetX, cursor.y - state.offsetY, false);
});

ipcMain.handle('window-drag-end', (event) => {
  dragState.delete(event.sender.id);
});

ipcMain.handle('set-glass-settings', (event, settings) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  applyGlassSettings(win, settings);
});

ipcMain.handle('fetch-json', async (event, rawUrl) => {
  const url = new URL(String(rawUrl || ''));
  const allowedHosts = new Set([
    'api.deezer.com',
    'itunes.apple.com',
    'en.wikipedia.org',
    'www.theaudiodb.com',
    'www.wikidata.org',
    'commons.wikimedia.org'
  ]);
  if (!allowedHosts.has(url.hostname)) {
    throw new Error(`Blocked API host: ${url.hostname}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
});
