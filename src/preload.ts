import { contextBridge, ipcRenderer } from 'electron';
import { ipcChannels } from './shared/ipc-channels';
import type { NetXScanApi } from './shared/preload-api';

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
  createAsset: (input) => ipcRenderer.invoke(ipcChannels.assetCreate, input),
  updateAsset: (id, input) =>
    ipcRenderer.invoke(ipcChannels.assetUpdate, { id, ...input }),
  archiveAsset: (id) => ipcRenderer.invoke(ipcChannels.assetArchive, { id }),
  getAuthorizedRanges: () =>
    ipcRenderer.invoke(ipcChannels.scanAuthorizedRanges),
  runAuthorizedScan: (target) =>
    ipcRenderer.invoke(ipcChannels.scanRun, { target }),
  getCompanyProfile: () => ipcRenderer.invoke(ipcChannels.companyGet),
  saveCompanyName: (companyName) =>
    ipcRenderer.invoke(ipcChannels.companySaveName, { companyName }),
  uploadCompanyLogo: () => ipcRenderer.invoke(ipcChannels.companyUploadLogo),
  removeCompanyLogo: () => ipcRenderer.invoke(ipcChannels.companyRemoveLogo),
  listAudit: (query = '') => ipcRenderer.invoke(ipcChannels.auditList, { query }),
});

contextBridge.exposeInMainWorld('netxscan', api);
