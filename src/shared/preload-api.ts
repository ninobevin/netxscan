export type NetXScanApi = {
  ping: () => Promise<string>;
  getAppVersion: () => Promise<string>;
};

declare global {
  interface Window {
    netxscan: NetXScanApi;
  }
}

export {};
