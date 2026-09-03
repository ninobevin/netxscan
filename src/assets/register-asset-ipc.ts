import { ipcMain } from 'electron';
import { ipcChannels } from '../shared/ipc-channels';
import { requireRole, requireSession } from '../auth/session';
import {
  addCategory,
  addLocation,
  deleteAsset,
  deleteAssets,
  getAssetById,
  listAssets,
  listCategories,
  listLocations,
  updateAsset,
  updateWinrm,
} from './repository';
import { errorMessage } from '../ipc/error-message';
import { checkAccessibility } from '../scan/winrm';
import { lookupMacWithNmap } from '../scan/nmap-mac';

let checking = false;

export function registerAssetIpc(): void {
  ipcMain.handle(ipcChannels.assetList, () => {
    try {
      requireSession();
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
      requireSession();
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

  ipcMain.handle(ipcChannels.locationList, () => {
    try {
      requireSession();
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

    checking = true;
    try {
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
        const host = asset.hostname ?? asset.ipv4;
        const result = await checkAccessibility(host, asset.ipv4, true);
        let macAddress = result.macAddress;
        if (!result.ok) {
          macAddress = (await lookupMacWithNmap(asset.ipv4)) ?? macAddress;
        }
        updateWinrm(asset.id, result.ok, result.osVersion, macAddress);
        event.sender.send(ipcChannels.assetsWinrmProgress, {
          assetId: asset.id,
          ipv4: asset.ipv4,
          status: result.ok ? 'ok' : 'failed',
          osVersion: result.osVersion,
          macAddress,
        });
      }
      return { ok: true, assets: listAssets() };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    } finally {
      checking = false;
    }
  });
}
