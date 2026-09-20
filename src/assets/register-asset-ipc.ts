import { ipcMain } from 'electron';
import { ipcChannels } from '../shared/ipc-channels';
import { requireRole, requireAppSession } from '../auth/session';
import {
  addCategory,
  addLocation,
  deleteAsset,
  deleteAssets,
  deleteCategory,
  deleteLocation,
  getAssetById,
  listAssets,
  listCategories,
  listLocations,
  updateAsset,
  updateCategory,
  updateLocation,
  updateWinrm,
} from './repository';
import { errorMessage } from '../ipc/error-message';
import { invokeWinrmDetails, isIpv4Literal, testWinrm, windowsIdentity } from '../scan/winrm';
import { lookupAdComputerNames } from '../scan/ad-computer';
import { lookupMacWithNmap } from '../scan/nmap-mac';

let checking = false;

export function registerAssetIpc(): void {
  ipcMain.handle(ipcChannels.assetList, () => {
    try {
      requireAppSession();
      return { ok: true, assets: listAssets() };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle(ipcChannels.assetUpdate, (_event, payload: unknown) => {
    try {
      requireRole('administrator');
    if (!payload || typeof payload !== 'object') {
      return { ok: false, error: 'Invalid asset update.' };
    }
    const id = Number((payload as { id?: unknown }).id);
    if (!Number.isInteger(id) || id < 1) {
      return { ok: false, error: 'Invalid asset.' };
    }
    const categoryIdRaw = (payload as { categoryId?: unknown }).categoryId;
    const categoryId =
      categoryIdRaw === undefined
        ? undefined
        : categoryIdRaw === null || categoryIdRaw === ''
          ? null
          : Number(categoryIdRaw);
    if (
      categoryId !== undefined &&
      categoryId !== null &&
      (!Number.isInteger(categoryId) || categoryId < 1)
    ) {
      return { ok: false, error: 'Invalid device.' };
    }
    const locationIdRaw = (payload as { locationId?: unknown }).locationId;
    const locationId =
      locationIdRaw === undefined
        ? undefined
        : locationIdRaw === null || locationIdRaw === ''
          ? null
          : Number(locationIdRaw);
    if (
      locationId !== undefined &&
      locationId !== null &&
      (!Number.isInteger(locationId) || locationId < 1)
    ) {
      return { ok: false, error: 'Invalid location.' };
    }
    const asset = updateAsset(id, {
      ...(categoryId !== undefined ? { categoryId } : {}),
      ...(locationId !== undefined ? { locationId } : {}),
    });
    if (!asset) {
      return { ok: false, error: 'Asset not found.' };
    }
    return { ok: true, assets: listAssets() };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle(ipcChannels.assetDelete, (_event, payload: unknown) => {
    try {
      requireRole('administrator');
      if (!payload || typeof payload !== 'object') {
        return { ok: false, error: 'Invalid request.' };
      }
      const idsRaw = (payload as { ids?: unknown }).ids;
      const idSingle = (payload as { id?: unknown }).id;
      const ids = Array.isArray(idsRaw)
        ? idsRaw.map(Number).filter((id) => Number.isInteger(id) && id > 0)
        : [Number(idSingle)].filter((id) => Number.isInteger(id) && id > 0);
      if (ids.length === 0) {
        return { ok: false, error: 'Select assets to delete.' };
      }
      if (ids.length === 1) {
        deleteAsset(ids[0]);
      } else {
        deleteAssets(ids);
      }
      return { ok: true, assets: listAssets() };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle(ipcChannels.categoryList, () => {
    try {
      requireAppSession();
      return { ok: true, categories: listCategories() };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle(ipcChannels.categoryAdd, (_event, payload: unknown) => {
    try {
      requireRole('administrator');
      if (!payload || typeof payload !== 'object') {
        return { ok: false, error: 'Invalid category.' };
      }
      const name = String((payload as { name?: unknown }).name ?? '');
      const icon = String((payload as { icon?: unknown }).icon ?? 'Tag');
      const created = addCategory(name, icon);
      if ('error' in created) {
        return { ok: false, error: created.error };
      }
      return { ok: true, categories: listCategories() };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle(ipcChannels.categoryUpdate, (_event, payload: unknown) => {
    try {
      requireRole('administrator');
      if (!payload || typeof payload !== 'object') {
        return { ok: false, error: 'Invalid category.' };
      }
      const body = payload as { id?: unknown; name?: unknown; icon?: unknown };
      const id = Number(body.id);
      if (!Number.isInteger(id) || id <= 0) {
        return { ok: false, error: 'Invalid category.' };
      }
      const updated = updateCategory(id, String(body.name ?? ''), String(body.icon ?? 'Tag'));
      if ('error' in updated) {
        return { ok: false, error: updated.error };
      }
      return { ok: true, categories: listCategories() };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle(ipcChannels.categoryDelete, (_event, payload: unknown) => {
    try {
      requireRole('administrator');
      if (!payload || typeof payload !== 'object') {
        return { ok: false, error: 'Invalid category.' };
      }
      const id = Number((payload as { id?: unknown }).id);
      if (!Number.isInteger(id) || id <= 0) {
        return { ok: false, error: 'Invalid category.' };
      }
      const result = deleteCategory(id);
      if ('error' in result) {
        return { ok: false, error: result.error };
      }
      return { ok: true, categories: listCategories() };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle(ipcChannels.locationList, () => {
    try {
      requireAppSession();
      return { ok: true, locations: listLocations() };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle(ipcChannels.locationAdd, (_event, payload: unknown) => {
    try {
      requireRole('administrator');
      if (!payload || typeof payload !== 'object') {
        return { ok: false, error: 'Invalid location.' };
      }
      const name = String((payload as { name?: unknown }).name ?? '');
      const created = addLocation(name);
      if ('error' in created) {
        return { ok: false, error: created.error };
      }
      return { ok: true, locations: listLocations() };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle(ipcChannels.locationUpdate, (_event, payload: unknown) => {
    try {
      requireRole('administrator');
      if (!payload || typeof payload !== 'object') {
        return { ok: false, error: 'Invalid location.' };
      }
      const body = payload as { id?: unknown; name?: unknown };
      const id = Number(body.id);
      if (!Number.isInteger(id) || id <= 0) {
        return { ok: false, error: 'Invalid location.' };
      }
      const updated = updateLocation(id, String(body.name ?? ''));
      if ('error' in updated) {
        return { ok: false, error: updated.error };
      }
      return { ok: true, locations: listLocations() };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle(ipcChannels.locationDelete, (_event, payload: unknown) => {
    try {
      requireRole('administrator');
      if (!payload || typeof payload !== 'object') {
        return { ok: false, error: 'Invalid location.' };
      }
      const id = Number((payload as { id?: unknown }).id);
      if (!Number.isInteger(id) || id <= 0) {
        return { ok: false, error: 'Invalid location.' };
      }
      const result = deleteLocation(id);
      if ('error' in result) {
        return { ok: false, error: result.error };
      }
      return { ok: true, locations: listLocations() };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle(ipcChannels.assetsWindowsIdentity, () => {
    try {
      requireAppSession();
      return { ok: true, username: windowsIdentity() };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle(ipcChannels.assetsCheckAccessibility, async (event, payload: unknown) => {
    try {
      requireRole('administrator');
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
    if (checking) {
      return { ok: false, error: 'Accessibility check is already running.' };
    }
    if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { ids?: unknown }).ids)) {
      return { ok: false, error: 'Select at least one asset.' };
    }
    const ids = (payload as { ids: unknown[] })
      .ids.map(Number)
      .filter((id) => Number.isInteger(id) && id > 0);
    if (ids.length === 0) {
      return { ok: false, error: 'Select at least one asset.' };
    }
    let username = String((payload as { username?: unknown }).username ?? '').trim();
    let password = String((payload as { password?: unknown }).password ?? '');
    if (!username || !password) {
      return { ok: false, error: 'Windows username and password are required.' };
    }

    checking = true;
    let credential: { username: string; password: string } | null = null;
    try {
      const pending: Array<{
        id: number;
        ipv4: string;
        storedHostname: string;
        needHostname: boolean;
        winrmOk: boolean;
      }> = [];

      for (const id of ids) {
        const asset = getAssetById(id);
        if (!asset) {
          continue;
        }
        event.sender.send(ipcChannels.assetsWinrmProgress, {
          assetId: asset.id,
          ipv4: asset.ipv4,
          status: 'checking',
        });
        const storedHostname = asset.hostname?.trim() || '';
        const needHostname =
          !storedHostname || storedHostname.toLowerCase() === asset.ipv4.toLowerCase();
        const winrmOk = await testWinrm(asset.ipv4, true);
        pending.push({
          id: asset.id,
          ipv4: asset.ipv4,
          storedHostname,
          needHostname,
          winrmOk,
        });
      }

      const needAd = pending
        .filter((row) => row.winrmOk && row.needHostname)
        .map((row) => row.ipv4);
      const adNames = needAd.length > 0 ? await lookupAdComputerNames(needAd) : new Map<string, string>();
      credential = { username, password };

      for (const row of pending) {
        let osVersion: string | null = null;
        let macAddress: string | null = null;
        let hostname: string | null = null;

        if (!row.winrmOk) {
          macAddress = await lookupMacWithNmap(row.ipv4);
        } else {
          const storedName =
            !row.needHostname && !isIpv4Literal(row.storedHostname) ? row.storedHostname : null;
          const computerName = storedName ?? adNames.get(row.ipv4) ?? null;
          if (computerName && credential) {
            const details = await invokeWinrmDetails(computerName, row.ipv4, credential);
            osVersion = details.osVersion;
            macAddress = details.macAddress;
            if (row.needHostname) {
              hostname = details.hostname || computerName;
            }
          }
        }

        updateWinrm(row.id, row.winrmOk, osVersion, macAddress, hostname);
        event.sender.send(ipcChannels.assetsWinrmProgress, {
          assetId: row.id,
          ipv4: row.ipv4,
          status: row.winrmOk ? 'ok' : 'failed',
          osVersion,
          macAddress,
          hostname,
        });
      }
      return { ok: true, assets: listAssets() };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    } finally {
      if (credential) {
        credential.username = '';
        credential.password = '';
        credential = null;
      }
      username = '';
      password = '';
      checking = false;
    }
  });
}
