import { contextBridge, ipcRenderer } from 'electron';
import { ipcChannels } from './shared/ipc-channels';
import type { NetXScanApi } from './shared/preload-api';

const api: NetXScanApi = Object.freeze({
  ping: () => ipcRenderer.invoke(ipcChannels.ping),
  getAppVersion: () => ipcRenderer.invoke(ipcChannels.getAppVersion),
});

contextBridge.exposeInMainWorld('netxscan', api);
