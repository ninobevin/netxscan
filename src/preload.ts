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
  getSetupStatus: () => ipcRenderer.invoke(ipcChannels.setupStatus),
  updateProfile: (profile) => ipcRenderer.invoke(ipcChannels.profileUpdate, profile),
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
  getCompanyBranding: () => ipcRenderer.invoke(ipcChannels.companyBranding),
  updateCompany: (profile) => ipcRenderer.invoke(ipcChannels.companyUpdate, profile),
  chooseCompanyLogo: () => ipcRenderer.invoke(ipcChannels.companySetLogo),
  clearCompanyLogo: () => ipcRenderer.invoke(ipcChannels.companyClearLogo),
  getAdhicsTree: () => ipcRenderer.invoke(ipcChannels.adhicsTree),
  listLeafControls: () => ipcRenderer.invoke(ipcChannels.adhicsLeafList),
  saveAdhicsDomain: (input) => ipcRenderer.invoke(ipcChannels.adhicsSaveDomain, input),
  deleteAdhicsDomain: (id) => ipcRenderer.invoke(ipcChannels.adhicsDeleteDomain, { id }),
  saveAdhicsFamily: (input) => ipcRenderer.invoke(ipcChannels.adhicsSaveFamily, input),
  deleteAdhicsFamily: (id) => ipcRenderer.invoke(ipcChannels.adhicsDeleteFamily, { id }),
  saveAdhicsControl: (input) => ipcRenderer.invoke(ipcChannels.adhicsSaveControl, input),
  deleteAdhicsControl: (id) => ipcRenderer.invoke(ipcChannels.adhicsDeleteControl, { id }),
  listAssessmentScripts: () => ipcRenderer.invoke(ipcChannels.scriptList),
  saveAssessmentScript: (input) => ipcRenderer.invoke(ipcChannels.scriptSave, input),
  deleteAssessmentScript: (id) => ipcRenderer.invoke(ipcChannels.scriptDelete, { id }),
  setScriptResult: (id, result) =>
    ipcRenderer.invoke(ipcChannels.scriptSetResult, { id, result }),
  listFindings: () => ipcRenderer.invoke(ipcChannels.findingList),
  updateFindingStatus: (id, status) =>
    ipcRenderer.invoke(ipcChannels.findingUpdateStatus, { id, status }),
  listReportBatches: () => ipcRenderer.invoke(ipcChannels.reportBatches),
  getReportPreview: (query) => ipcRenderer.invoke(ipcChannels.reportPreview, query),
  saveComplianceReport: (query) => ipcRenderer.invoke(ipcChannels.reportSavePdf, query),
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
