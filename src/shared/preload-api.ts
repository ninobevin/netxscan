export type NetXScanApi = {
  // Module 1: no privileged methods.
  // Module 2: add ping / getAppVersion here.
};

declare global {
  interface Window {
    netxscan: NetXScanApi;
  }
}

export {};
