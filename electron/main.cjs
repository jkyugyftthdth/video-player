'use strict';
const { app, BrowserWindow, ipcMain, protocol, Menu } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { Readable } = require('node:stream');
const media = require('./media.cjs');

const VIDEO_EXT = new Set([
  'mp4', 'm4v', 'mov', 'mkv', 'webm', 'avi', 'wmv', 'asf', 'flv', 'f4v', 'ts', 'm2ts', 'mts', 'mpg', 'mpeg', 'mpe', 'vob',
  'ogv', 'ogm', '3gp', '3g2', 'divx', 'xvid', 'rm', 'rmvb', 'mxf', 'qt', 'dv', 'y4m', 'm2v', 'evo', 'wtv', 'dvr-ms',
]);
const IMAGE_MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const VIDEO_MIME = { mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/mp4', webm: 'video/webm', mkv: 'video/x-matroska', ogv: 'video/ogg' };

protocol.registerSchemesAsPrivileged([
  { scheme: 'localmedia', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true, bypassCSP: true } },
]);

// ---- persistent settings (read before the app is ready so GPU flags can be applied) ----
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
function readSettings() {
  try { return { hwDecode: true, ...JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) }; } catch { return { hwDecode: true }; }
}
function writeSettings(s) {
  try { fs.mkdirSync(path.dirname(settingsFile()), { recursive: true }); fs.writeFileSync(settingsFile(), JSON.stringify(s)); } catch {}
}
const settings = readSettings();

if (settings.hwDecode) {
  // Hardware decoding (D3D11VA / DXVA) incl. HEVC when the GPU + Windows codec support it.
  app.commandLine.appendSwitch('enable-features', 'PlatformHEVCDecoderSupport,HardwareMediaKeyHandling');
  app.commandLine.appendSwitch('ignore-gpu-blocklist');
  app.commandLine.appendSwitch('enable-gpu-rasterization');
} else {
  // Pure software decoding.
  app.commandLine.appendSwitch('disable-accelerated-video-decode');
  app.commandLine.appendSwitch('disable-gpu-memory-buffer-video-frames');
}

const isDev = !app.isPackaged && process.env.ELECTRON_DEV_URL;
let mainWindow = null;
let rendererReady = false;
const pendingOpen = [];
let cacheDir = null;

const extOf = (p) => path.extname(p).slice(1).toLowerCase();
const toMediaUrl = (p) => 'localmedia://file/' + encodeURIComponent(p);

function videoArgs(argv) {
  return argv.slice(app.isPackaged ? 1 : 2)
    .filter((a) => !a.startsWith('-') && VIDEO_EXT.has(extOf(a)) && fs.existsSync(a))
    .map((a) => path.resolve(a));
}
function deliverOpen(files) {
  if (!files.length) return;
  if (mainWindow && rendererReady) {
    mainWindow.webContents.send('open-files', files);
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  } else pendingOpen.push(...files);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360, height: 860, minWidth: 360, minHeight: 200, show: false, title: 'Video Player', backgroundColor: '#202020',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: false,
      autoplayPolicy: 'no-user-gesture-required', backgroundThrottling: false,
    },
  });
  Menu.setApplicationMenu(null);
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file:') && !(isDev && url.startsWith(process.env.ELECTRON_DEV_URL))) e.preventDefault();
  });
  mainWindow.on('closed', () => { mainWindow = null; rendererReady = false; media.cancelAll(); });
  if (isDev) mainWindow.loadURL(process.env.ELECTRON_DEV_URL);
  else mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

function serveFile(request) {
  const url = new URL(request.url);
  const filePath = decodeURIComponent(url.pathname.slice(1));
  const ext = extOf(filePath);
  const inCache = cacheDir && path.resolve(filePath).startsWith(cacheDir);
  if (!inCache && !VIDEO_EXT.has(ext) && !IMAGE_MIME[ext]) return new Response('Forbidden', { status: 403 });
  let stat;
  try { stat = fs.statSync(filePath); } catch { return new Response('Not found', { status: 404 }); }
  const size = stat.size;
  const headers = {
    'Content-Type': VIDEO_MIME[ext] || IMAGE_MIME[ext] || 'application/octet-stream',
    'Accept-Ranges': 'bytes', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store',
  };
  let start = 0, end = size - 1, status = 200;
  const range = request.headers.get('range');
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    if (m) {
      if (m[1] === '' && m[2] !== '') start = Math.max(0, size - parseInt(m[2], 10));
      else {
        if (m[1] !== '') start = parseInt(m[1], 10);
        if (m[2] !== '') end = Math.min(size - 1, parseInt(m[2], 10));
      }
      if (start > end || start >= size) return new Response('Range Not Satisfiable', { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
      status = 206;
      headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
    }
  }
  headers['Content-Length'] = String(size === 0 ? 0 : end - start + 1);
  if (size === 0) return new Response(null, { status: 200, headers });
  return new Response(Readable.toWeb(fs.createReadStream(filePath, { start, end })), { status, headers });
}

app.setAppUserModelId('com.videoplayer.desktop');
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => deliverOpen(videoArgs(argv)));

  app.whenReady().then(() => {
    cacheDir = path.join(app.getPath('userData'), 'playback-cache');
    media.pruneCache(cacheDir);
    protocol.handle('localmedia', serveFile);

    ipcMain.handle('media:analyze', async (_e, file) => {
      try {
        const info = await media.probe(file);
        let thumb = null;
        if (info.video) thumb = await media.thumbnail(file, Math.min(10, Math.max(0.5, info.duration * 0.1)));
        let size = 0;
        try { size = fs.statSync(file).size; } catch {}
        return { ...info, size, thumbnail: thumb };
      } catch (err) { return { ok: false, error: String(err), audio: [], subtitles: [], video: null, duration: 0 }; }
    });
    ipcMain.handle('media:subtitles', (_e, file, count) => media.extractSubtitles(file, count, path.join(cacheDir, 'subs')));
    ipcMain.handle('media:prepare', async (e, id, file, opts) => {
      const out = await media.prepare(file, { ...opts, hw: settings.hwDecode }, cacheDir, (p) => {
        if (!e.sender.isDestroyed()) e.sender.send('prepare-progress', { id, progress: p });
      });
      return toMediaUrl(out);
    });
    ipcMain.handle('media:cancel', () => media.cancelAll());
    ipcMain.handle('media:url', (_e, file) => toMediaUrl(file));
    ipcMain.handle('media:capabilities', async () => ({ ...(await media.capabilities()), hwDecode: settings.hwDecode }));
    ipcMain.handle('media:clear-cache', () => { media.cancelAll(); media.clearCache(cacheDir); return true; });
    ipcMain.handle('settings:get', () => settings);
    ipcMain.handle('settings:set', (_e, patch) => { Object.assign(settings, patch); writeSettings(settings); return settings; });
    ipcMain.handle('app:relaunch', () => { app.relaunch(); app.exit(0); });
    ipcMain.on('renderer-ready', () => {
      rendererReady = true;
      if (pendingOpen.length) mainWindow?.webContents.send('open-files', pendingOpen.splice(0));
    });

    pendingOpen.push(...videoArgs(process.argv));
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });
  app.on('window-all-closed', () => app.quit());
}
