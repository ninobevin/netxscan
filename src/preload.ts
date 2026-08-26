import { contextBridge, ipcRenderer } from 'electron';
import { ipcChannels } from './shared/ipc-channels';
import type { Asset } from './shared/asset-types';
import type { NetXScanApi } from './shared/preload-api';
import type { WinrmProgress } from './shared/winrm-types';

const api: NetXScanApi = Object.freeze({
  ping: () => ipcRenderer.invoke(ipcChannels.ping),
  getAppVersion: () => ipcRenderer.invoke(ipcChannels.getAppVersion),
  getDatabaseStatus: () => ipcRenderer.invoke(ipcChannels.getDatabaseStatus),
  login: (username, password) =>
    ipcRenderer.invoke(ipcChannels.login, { username, password }),
  logout: () => ipcRenderer.invoke(ipcChannels.logout),
  getSession: () => ipcRenderer.invoke(ipcChannels.getSession),
  listAssets: (includeArchived = false) =>
    ipcRenderer.invoke(ipcChannels.assetList, { includeArchived }),
  getAsset: (id) => ipcRenderer.invoke(ipcChannels.assetGet, { id }),
  updateAsset: (id, input) =>
    ipcRenderer.invoke(ipcChannels.assetUpdate, { id, ...input }),
  deleteAsset: (id) => ipcRenderer.invoke(ipcChannels.assetDelete, { id }),
  deleteAssets: (ids) =>
    ipcRenderer.invoke(ipcChannels.assetDeleteMany, { ids }),
  runWinrmBatch: (action, ids) =>
    ipcRenderer.invoke(ipcChannels.winrmBatch, { action, ids }),
  onWinrmProgress: (listener) => {
    const wrapped = (_event: unknown, progress: WinrmProgress) => {
      listener(progress);
    };
    ipcRenderer.on(ipcChannels.winrmProgress, wrapped);
    return () => {
      ipcRenderer.removeListener(ipcChannels.winrmProgress, wrapped);
    };
  },
  listLocations: () => ipcRenderer.invoke(ipcChannels.locationList),
  addLocation: (name) => ipcRenderer.invoke(ipcChannels.locationAdd, { name }),
  getAuthorizedRanges: () =>
    ipcRenderer.invoke(ipcChannels.scanAuthorizedRanges),
  runAuthorizedScan: (target) =>
    ipcRenderer.invoke(ipcChannels.scanRun, { target }),
  onScanHostFound: (listener) => {
    const wrapped = (_event: unknown, asset: Asset) => {
      listener(asset);
    };
    ipcRenderer.on(ipcChannels.scanHostFound, wrapped);
    return () => {
      ipcRenderer.removeListener(ipcChannels.scanHostFound, wrapped);
    };
  },
  getCompanyProfile: () => ipcRenderer.invoke(ipcChannels.companyGet),
  saveCompanyName: (companyName) =>
    ipcRenderer.invoke(ipcChannels.companySaveName, { companyName }),
  uploadCompanyLogo: () => ipcRenderer.invoke(ipcChannels.companyUploadLogo),
  removeCompanyLogo: () => ipcRenderer.invoke(ipcChannels.companyRemoveLogo),
  listAudit: (query = '') => ipcRenderer.invoke(ipcChannels.auditList, { query }),
});

contextBridge.exposeInMainWorld('netxscan', api);
