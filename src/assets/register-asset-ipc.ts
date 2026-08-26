import { ipcMain } from 'electron';
import { requireSession } from '../auth/session';
import { writeAudit } from '../audit/repository';
import type {
  AssetItemResult,
  AssetListResult,
  LocationListResult,
} from '../shared/asset-types';
import { ipcChannels } from '../shared/ipc-channels';
import { addLocationName, listLocationNames } from './locations';
import {
  deleteAsset,
  getAssetById,
  isDuplicateError,
  listAssets,
  updateAsset,
} from './repository';
import {
  parseAssetId,
  parseAssetInput,
  parseLocationName,
} from './validate';

function requireAuth(): boolean {
  try {
    requireSession();
    return true;
  } catch {
    return false;
  }
}

export function registerAssetIpc(): void {
  ipcMain.handle(
    ipcChannels.assetList,
    async (_event, payload: unknown): Promise<AssetListResult> => {
      if (!requireAuth()) {
        return { ok: false, error: 'unauthorized' };
      }

      const includeArchived =
        !!payload &&
        typeof payload === 'object' &&
        (payload as { includeArchived?: unknown }).includeArchived === true;

      try {
        const assets = await listAssets(includeArchived);
        return { ok: true, assets };
      } catch {
        return { ok: false, error: 'database_unavailable' };
      }
    },
  );

  ipcMain.handle(
    ipcChannels.assetGet,
    async (_event, payload: unknown): Promise<AssetItemResult> => {
      if (!requireAuth()) {
        return { ok: false, error: 'unauthorized' };
      }

      const id = parseAssetId(payload);

      if (!id) {
        return { ok: false, error: 'invalid_input' };
      }

      try {
        const asset = await getAssetById(id);
        return asset ? { ok: true, asset } : { ok: false, error: 'not_found' };
      } catch {
        return { ok: false, error: 'database_unavailable' };
      }
    },
  );

  ipcMain.handle(
    ipcChannels.assetUpdate,
    async (_event, payload: unknown): Promise<AssetItemResult> => {
      if (!requireAuth()) {
        return { ok: false, error: 'unauthorized' };
      }

      const id = parseAssetId(payload);
      const input = parseAssetInput(payload);

      if (!id || !input) {
        return { ok: false, error: 'invalid_input' };
      }

      try {
        const asset = await updateAsset(id, input);
        if (!asset) {
          return { ok: false, error: 'not_found' };
        }

        await writeAudit(
          'asset_update',
          `${asset.hostname}${asset.ipAddress ? ` (${asset.ipAddress})` : ''}`,
        );
        return { ok: true, asset };
      } catch (error) {
        if (isDuplicateError(error)) {
          return { ok: false, error: 'duplicate' };
        }

        return { ok: false, error: 'database_unavailable' };
      }
    },
  );

  ipcMain.handle(
    ipcChannels.assetDelete,
    async (_event, payload: unknown): Promise<AssetItemResult> => {
      if (!requireAuth()) {
        return { ok: false, error: 'unauthorized' };
      }

      const id = parseAssetId(payload);

      if (!id) {
        return { ok: false, error: 'invalid_input' };
      }

      try {
        const asset = await deleteAsset(id);
        if (!asset) {
          return { ok: false, error: 'not_found' };
        }

        await writeAudit(
          'asset_delete',
          `${asset.hostname}${asset.ipAddress ? ` (${asset.ipAddress})` : ''}`,
        );
        return { ok: true, asset };
      } catch {
        return { ok: false, error: 'database_unavailable' };
      }
    },
  );

  ipcMain.handle(
    ipcChannels.locationList,
    async (): Promise<LocationListResult> => {
      if (!requireAuth()) {
        return { ok: false, error: 'unauthorized' };
      }

      try {
        const locations = await listLocationNames();
        return { ok: true, locations };
      } catch {
        return { ok: false, error: 'database_unavailable' };
      }
    },
  );

  ipcMain.handle(
    ipcChannels.locationAdd,
    async (_event, payload: unknown): Promise<LocationListResult> => {
      if (!requireAuth()) {
        return { ok: false, error: 'unauthorized' };
      }

      const name = parseLocationName(payload);
      if (!name) {
        return { ok: false, error: 'invalid_input' };
      }

      try {
        const locations = await addLocationName(name);
        await writeAudit('location_add', name);
        return { ok: true, locations };
      } catch {
        return { ok: false, error: 'database_unavailable' };
      }
    },
  );
}
