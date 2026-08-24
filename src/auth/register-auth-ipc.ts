import { ipcMain } from 'electron';
import { writeAudit } from '../audit/repository';
import { ipcChannels } from '../shared/ipc-channels';
import { login } from './login';
import { clearSession, getActiveSession, requireSession } from './session';

export function registerAuthIpc(): void {
  ipcMain.handle(ipcChannels.login, async (_event, payload: unknown) => {
    const result = await login(payload);
    const username =
      payload && typeof payload === 'object'
        ? String((payload as { username?: unknown }).username ?? '').trim()
        : '';

    if (result.ok) {
      await writeAudit('login_success', 'Signed in.', result.session.username);
    } else {
      await writeAudit(
        'login_failure',
        result.error,
        username || 'unknown',
      );
    }

    return result;
  });

  ipcMain.handle(ipcChannels.logout, async () => {
    const username = getActiveSession()?.username ?? 'anonymous';
    clearSession();
    await writeAudit('logout', 'Signed out.', username);
  });

  ipcMain.handle(ipcChannels.getSession, () => {
    return getActiveSession();
  });
}

export { requireSession };
