import { ipcMain } from 'electron';
import { errorMessage } from '../ipc/error-message';
import { ipcChannels } from '../shared/ipc-channels';
import { login } from './login';
import { clearSession, getActiveSession, requireRole, requireSession } from './session';
import {
  beginTotpSetup,
  changeOwnPassword,
  clearPendingTotp,
  confirmTotpSetup,
  resetPasswordWithTotp,
  anyAuthenticatorEnrolled,
} from './totp';
import { addUser, deleteUser, listUsers, updateOwnProfile, updateUser } from './users';

function asObject(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  return payload as Record<string, unknown>;
}

export function registerAuthIpc(): void {
  ipcMain.handle(ipcChannels.login, async (_event, payload: unknown) => {
    return login(payload);
  });

  ipcMain.handle(ipcChannels.logout, () => {
    const active = getActiveSession();
    clearPendingTotp(active?.username);
    clearSession();
  });

  ipcMain.handle(ipcChannels.getSession, () => {
    return getActiveSession();
  });

  ipcMain.handle(ipcChannels.setupStatus, () => {
    return { firstTimeSetup: !anyAuthenticatorEnrolled() };
  });

  ipcMain.handle(ipcChannels.changePassword, async (_event, payload: unknown) => {
    try {
      requireSession();
      const body = asObject(payload);
      if (!body) {
        return { ok: false, error: 'Invalid password change.' };
      }
      const result = await changeOwnPassword(
        String(body.currentPassword ?? ''),
        body.nextPassword,
      );
      if ('error' in result) {
        return { ok: false, error: result.error };
      }
      return { ok: true, session: result };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle(ipcChannels.totpBegin, async () => {
    try {
      requireSession();
      const result = await beginTotpSetup();
      if ('error' in result) {
        return { ok: false, error: result.error };
      }
      return { ok: true, qrDataUrl: result.qrDataUrl };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle(ipcChannels.totpConfirm, (_event, payload: unknown) => {
    try {
      requireSession();
      const body = asObject(payload);
      if (!body) {
        return { ok: false, error: 'Invalid authenticator code.' };
      }
      const result = confirmTotpSetup(String(body.code ?? ''));
      if ('error' in result) {
        return { ok: false, error: result.error };
      }
      return { ok: true, session: result };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle(ipcChannels.forgotPassword, async (_event, payload: unknown) => {
    const body = asObject(payload);
    if (!body) {
      return { ok: false, error: 'Username, authenticator code, and password are required.' };
    }
    const result = await resetPasswordWithTotp(body.username, body.code, body.password);
    if ('error' in result) {
      return { ok: false, error: result.error };
    }
    return { ok: true };
  });

  ipcMain.handle(ipcChannels.profileUpdate, (_event, payload: unknown) => {
    try {
      const result = updateOwnProfile(payload);
      if ('error' in result) {
        return { ok: false, error: result.error };
      }
      return { ok: true, session: result };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle(ipcChannels.userList, () => {
    try {
      requireRole('administrator');
      return { ok: true, users: listUsers() };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle(ipcChannels.userAdd, (_event, payload: unknown) => {
    try {
      requireRole('administrator');
      const body = asObject(payload);
      if (!body) {
        return { ok: false, error: 'Invalid user.' };
      }
      const created = addUser(body.username, body.password, body.role);
      if ('error' in created) {
        return { ok: false, error: created.error };
      }
      return { ok: true, users: created };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle(ipcChannels.userUpdate, (_event, payload: unknown) => {
    try {
      requireRole('administrator');
      const body = asObject(payload);
      if (!body) {
        return { ok: false, error: 'Invalid user.' };
      }
      const id = Number(body.id);
      if (!Number.isInteger(id) || id <= 0) {
        return { ok: false, error: 'Invalid user.' };
      }
      const updated = updateUser(id, body.username, body.password, body.role);
      if ('error' in updated) {
        return { ok: false, error: updated.error };
      }
      return { ok: true, users: updated };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle(ipcChannels.userDelete, (_event, payload: unknown) => {
    try {
      const actor = requireRole('administrator');
      const body = asObject(payload);
      if (!body) {
        return { ok: false, error: 'Invalid user.' };
      }
      const id = Number(body.id);
      if (!Number.isInteger(id) || id <= 0) {
        return { ok: false, error: 'Invalid user.' };
      }
      const result = deleteUser(id, actor.username);
      if ('error' in result) {
        return { ok: false, error: result.error };
      }
      return { ok: true, users: result };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  });
}
