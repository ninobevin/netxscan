/**
 * Named IPC channel allowlist.
 * Module 1: no ipcMain handlers yet.
 * Module 2: add the first non-privileged invoke test here.
 */
export const ipcChannels = {
  // Example (Module 2): appGetVersion: 'app:get-version',
} as const;

export type IpcChannel = (typeof ipcChannels)[keyof typeof ipcChannels];
