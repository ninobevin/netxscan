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
  changePassword: (currentPassword, nextPassword) =>
    ipcRenderer.invoke(ipcChannels.changePassword, { currentPassword, nextPassword }),
  beginTotpSetup: () => ipcRenderer.invoke(ipcChannels.totpBegin),
  confirmTotpSetup: (code) => ipcRenderer.invoke(ipcChannels.totpConfirm, { code }),
  forgotPassword: (username, authenticatorCode, nextPassword) =>
    ipcRenderer.invoke(ipcChannels.forgotPassword, {
      username,
      code: authenticatorCode,
      password: nextPassword,
    }),
  listUsers: () => ipcRenderer.invoke(ipcChannels.userList),
  addUser: (username, password, role) =>
    ipcRenderer.invoke(ipcChannels.userAdd, { username, password, role }),
  updateUser: (id, input) => ipcRenderer.invoke(ipcChannels.userUpdate, { id, ...input }),
  deleteUser: (id) => ipcRenderer.invoke(ipcChannels.userDelete, { id }),
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
  updateCategory: (id, name, icon) =>
    ipcRenderer.invoke(ipcChannels.categoryUpdate, { id, name, icon }),
  deleteCategory: (id) => ipcRenderer.invoke(ipcChannels.categoryDelete, { id }),
  listLocations: () => ipcRenderer.invoke(ipcChannels.locationList),
  addLocation: (name) => ipcRenderer.invoke(ipcChannels.locationAdd, { name }),
  updateLocation: (id, name) =>
    ipcRenderer.invoke(ipcChannels.locationUpdate, { id, name }),
  deleteLocation: (id) => ipcRenderer.invoke(ipcChannels.locationDelete, { id }),
  getCompany: () => ipcRenderer.invoke(ipcChannels.companyGet),
  updateCompany: (profile) => ipcRenderer.invoke(ipcChannels.companyUpdate, profile),
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
