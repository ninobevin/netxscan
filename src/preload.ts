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
  runDiscoveryScan: (target) =>
    ipcRenderer.invoke(ipcChannels.scanDiscover, { target }),
  runServiceAssessment: (assetId) =>
    ipcRenderer.invoke(ipcChannels.assessRun, { id: assetId }),
  getLatestAssessment: (assetId) =>
    ipcRenderer.invoke(ipcChannels.assessLatest, { id: assetId }),
  runLocalWindowsAssessment: () =>
    ipcRenderer.invoke(ipcChannels.windowsAssessLocal),
  runRemoteWindowsAssessment: (assetId, credentialId) =>
    ipcRenderer.invoke(ipcChannels.windowsAssessRemote, {
      id: assetId,
      credentialId,
    }),
  uninstallWindowsSoftware: (assetId, key, mode, credentialId) =>
    ipcRenderer.invoke(ipcChannels.windowsUninstallSoftware, {
      id: assetId,
      key,
      mode,
      credentialId,
    }),
  getLatestWindowsAssessment: (assetId) =>
    ipcRenderer.invoke(ipcChannels.windowsLatest, { id: assetId }),
  listCredentials: () => ipcRenderer.invoke(ipcChannels.credentialsList),
  saveCredential: (label, username, password) =>
    ipcRenderer.invoke(ipcChannels.credentialsSave, {
      label,
      username,
      password,
    }),
  deleteCredential: (id) =>
    ipcRenderer.invoke(ipcChannels.credentialsDelete, { id }),
  listCves: (query = '') => ipcRenderer.invoke(ipcChannels.cveList, { query }),
  importCveTestDataset: () => ipcRenderer.invoke(ipcChannels.cveImportTest),
  importCveFile: () => ipcRenderer.invoke(ipcChannels.cveImportFile),
  updateCvesOnline: () => ipcRenderer.invoke(ipcChannels.cveUpdateOnline),
  getLatestCorrelation: () => ipcRenderer.invoke(ipcChannels.correlateLatest),
  runCorrelation: () => ipcRenderer.invoke(ipcChannels.correlateRun),
  listFindings: (status = 'all') =>
    ipcRenderer.invoke(ipcChannels.findingsList, { status }),
  syncFindings: () => ipcRenderer.invoke(ipcChannels.findingsSync),
  updateFinding: (id, status, notes) =>
    ipcRenderer.invoke(ipcChannels.findingsUpdate, { id, status, notes }),
  getDashboard: () => ipcRenderer.invoke(ipcChannels.dashboardGet),
  getCompanyProfile: () => ipcRenderer.invoke(ipcChannels.companyGet),
  saveCompanyName: (companyName) =>
    ipcRenderer.invoke(ipcChannels.companySaveName, { companyName }),
  uploadCompanyLogo: () => ipcRenderer.invoke(ipcChannels.companyUploadLogo),
  removeCompanyLogo: () => ipcRenderer.invoke(ipcChannels.companyRemoveLogo),
  listAudit: (query = '') => ipcRenderer.invoke(ipcChannels.auditList, { query }),
  previewReport: (kind) =>
    ipcRenderer.invoke(ipcChannels.reportsPreview, { kind }),
  exportReport: (kind) =>
    ipcRenderer.invoke(ipcChannels.reportsExport, { kind }),
});

contextBridge.exposeInMainWorld('netxscan', api);
