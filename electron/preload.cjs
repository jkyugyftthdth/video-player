'use strict';
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  getPathForFile: (file) => { try { return webUtils.getPathForFile(file) || ''; } catch { return ''; } },
  analyze: (p) => ipcRenderer.invoke('media:analyze', p),
  subtitles: (p, count) => ipcRenderer.invoke('media:subtitles', p, count),
  prepare: (id, p, opts) => ipcRenderer.invoke('media:prepare', id, p, opts),
  cancelPrepare: () => ipcRenderer.invoke('media:cancel'),
  mediaUrl: (p) => ipcRenderer.invoke('media:url', p),
  capabilities: () => ipcRenderer.invoke('media:capabilities'),
  clearCache: () => ipcRenderer.invoke('media:clear-cache'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
  relaunch: () => ipcRenderer.invoke('app:relaunch'),
  onPrepareProgress: (cb) => {
    const h = (_e, d) => cb(d);
    ipcRenderer.on('prepare-progress', h);
    return () => ipcRenderer.removeListener('prepare-progress', h);
  },
  onOpenFiles: (cb) => {
    const h = (_e, files) => cb(files);
    ipcRenderer.on('open-files', h);
    ipcRenderer.send('renderer-ready');
    return () => ipcRenderer.removeListener('open-files', h);
  },
});
