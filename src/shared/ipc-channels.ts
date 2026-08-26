export const ipcChannels = {
  ping: 'app:ping',
  getAppVersion: 'app:get-version',
  getDatabaseStatus: 'app:get-database-status',
  login: 'auth:login',
  logout: 'auth:logout',
  getSession: 'auth:get-session',
  assetList: 'asset:list',
  assetGet: 'asset:get',
  assetUpdate: 'asset:update',
  assetDelete: 'asset:delete',
  locationList: 'location:list',
  locationAdd: 'location:add',
  scanAuthorizedRanges: 'scan:authorized-ranges',
  scanRun: 'scan:run',
  scanHostFound: 'scan:host-found',
  companyGet: 'company:get',
  companySaveName: 'company:save-name',
  companyUploadLogo: 'company:upload-logo',
  companyRemoveLogo: 'company:remove-logo',
  auditList: 'audit:list',
} as const;

export type IpcChannel = (typeof ipcChannels)[keyof typeof ipcChannels];
