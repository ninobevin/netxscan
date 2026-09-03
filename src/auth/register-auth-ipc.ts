import { ipcMain } from 'electron';
import { ipcChannels } from '../shared/ipc-channels';
import { login } from './login';
import { clearSession, getActiveSession } from './session';

export function registerAuthIpc(): void {
  ipcMain.handle(ipcChannels.login, async (_event, payload: unknown) => {
    return login(payload);
  });

  ipcMain.handle(ipcChannels.logout, () => {
    clearSession();
  });

  ipcMain.handle(ipcChannels.getSession, () => {
    return getActiveSession();
  });
}
