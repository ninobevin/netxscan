export const ipcChannels = {
  ping: 'app:ping',
  getAppVersion: 'app:get-version',
  getDatabaseStatus: 'app:get-database-status',
  login: 'auth:login',
  logout: 'auth:logout',
  getSession: 'auth:get-session',
  assetList: 'asset:list',
  assetGet: 'asset:get',
  assetCreate: 'asset:create',
  assetUpdate: 'asset:update',
  assetArchive: 'asset:archive',
  scanAuthorizedRanges: 'scan:authorized-ranges',
  scanRun: 'scan:run',
  companyGet: 'company:get',
  companySaveName: 'company:save-name',
  companyUploadLogo: 'company:upload-logo',
  companyRemoveLogo: 'company:remove-logo',
  auditList: 'audit:list',
} as const;

export type IpcChannel = (typeof ipcChannels)[keyof typeof ipcChannels];
