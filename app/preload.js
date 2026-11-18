'use strict';
// The only bridge between the browser window's own interface and the main process.
const { contextBridge, ipcRenderer } = require('electron');
const IN = ['cmd', 'open-tab', 'dl', 'update-state', 'adblock', 'appupdate'];
contextBridge.exposeInMainWorld('lb', {
  info: () => ipcRenderer.invoke('lb:info'),
  external: (url) => ipcRenderer.send('lb:external', String(url)),
  fullscreen: (on) => ipcRenderer.send('lb:fullscreen', !!on),
  download: (op, id) => ipcRenderer.send('lb:dl', String(op), Number(id)),
  clear: (what) => ipcRenderer.invoke('lb:clear', String(what)),
  perms: (op) => ipcRenderer.invoke('lb:perms', String(op)),
  update: (op) => ipcRenderer.invoke('lb:update', String(op)),
  appUpdate: (op) => ipcRenderer.invoke('lb:appupdate', String(op)),
  adblock: (op) => ipcRenderer.invoke('lb:adblock', String(op)),
  on: (channel, fn) => { if (IN.indexOf(channel) >= 0) ipcRenderer.on('lb:' + channel, (_e, data) => fn(data)); }
});
