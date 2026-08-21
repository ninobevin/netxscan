import { app, ipcMain } from 'electron';
import { ipcChannels } from '../shared/ipc-channels';

export function registerIpcHandlers(): void {
  ipcMain.handle(ipcChannels.ping, () => 'pong');
  ipcMain.handle(ipcChannels.getAppVersion, () => app.getVersion());
}
