export const ipcChannels = {
  ping: 'app:ping',
  getAppVersion: 'app:get-version',
  login: 'auth:login',
  logout: 'auth:logout',
  getSession: 'auth:get-session',
  scanRun: 'scan:run',
  scanHostFound: 'scan:host-found',
  scanAddToAssets: 'scan:add-to-assets',
  assetList: 'asset:list',
  assetUpdate: 'asset:update',
  assetDelete: 'asset:delete',
  categoryList: 'category:list',
  categoryAdd: 'category:add',
  locationList: 'location:list',
  locationAdd: 'location:add',
  assetsCheckAccessibility: 'assets:check-accessibility',
  assetsWinrmProgress: 'assets:winrm-progress',
} as const;

export type IpcChannel = (typeof ipcChannels)[keyof typeof ipcChannels];
