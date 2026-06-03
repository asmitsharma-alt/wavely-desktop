const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('wavelyDesktop', {
  isElectron: true,
  windowControl(action) {
    return ipcRenderer.invoke('window-control', action);
  },
  isWindowMaximized() {
    return ipcRenderer.invoke('is-window-maximized');
  },
  startWindowDrag() {
    return ipcRenderer.invoke('window-drag-start');
  },
  moveWindowDrag() {
    return ipcRenderer.invoke('window-drag-move');
  },
  endWindowDrag() {
    return ipcRenderer.invoke('window-drag-end');
  },
  setGlassSettings(settings) {
    return ipcRenderer.invoke('set-glass-settings', settings);
  },
  fetchJson(url) {
    return ipcRenderer.invoke('fetch-json', url);
  }
});
