/**
 * Named IPC channel allowlist.
 * Only these strings may be used with ipcRenderer.invoke / ipcMain.handle.
 */
export const ipcChannels = {
  ping: 'app:ping',
  getAppVersion: 'app:get-version',
} as const;

export type IpcChannel = (typeof ipcChannels)[keyof typeof ipcChannels];
