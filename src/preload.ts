import { contextBridge, ipcRenderer } from 'electron';
import { ipcChannels } from './shared/ipc-channels';
import type { NetXScanApi } from './shared/preload-api';
import type { ScanHost } from './shared/asset-types';
import type { WinrmProgress } from './shared/asset-types';

const api: NetXScanApi = Object.freeze({
  ping: () => ipcRenderer.invoke(ipcChannels.ping),
  getAppVersion: () => ipcRenderer.invoke(ipcChannels.getAppVersion),
  login: (username, password) =>
    ipcRenderer.invoke(ipcChannels.login, { username, password }),
  logout: () => ipcRenderer.invoke(ipcChannels.logout),
  getSession: () => ipcRenderer.invoke(ipcChannels.getSession),
  runScan: (target, mode) =>
    ipcRenderer.invoke(ipcChannels.scanRun, { target, mode }),
  onScanHostFound: (listener) => {
    const wrapped = (_event: unknown, host: ScanHost) => {
      listener(host);
    };
    ipcRenderer.on(ipcChannels.scanHostFound, wrapped);
    return () => {
      ipcRenderer.removeListener(ipcChannels.scanHostFound, wrapped);
    };
  },
  addScanToAssets: (hosts) =>
    ipcRenderer.invoke(ipcChannels.scanAddToAssets, { hosts }),
  listAssets: () => ipcRenderer.invoke(ipcChannels.assetList),
  updateAsset: (id, input) =>
    ipcRenderer.invoke(ipcChannels.assetUpdate, { id, ...input }),
  deleteAssets: (ids) => ipcRenderer.invoke(ipcChannels.assetDelete, { ids }),
  listCategories: () => ipcRenderer.invoke(ipcChannels.categoryList),
  addCategory: (name, icon) =>
    ipcRenderer.invoke(ipcChannels.categoryAdd, { name, icon }),
  listLocations: () => ipcRenderer.invoke(ipcChannels.locationList),
  addLocation: (name) => ipcRenderer.invoke(ipcChannels.locationAdd, { name }),
  checkAccessibility: (ids) =>
    ipcRenderer.invoke(ipcChannels.assetsCheckAccessibility, { ids }),
  onWinrmProgress: (listener) => {
    const wrapped = (_event: unknown, progress: WinrmProgress) => {
      listener(progress);
    };
    ipcRenderer.on(ipcChannels.assetsWinrmProgress, wrapped);
    return () => {
      ipcRenderer.removeListener(ipcChannels.assetsWinrmProgress, wrapped);
    };
  },
});

contextBridge.exposeInMainWorld('netxscan', api);
