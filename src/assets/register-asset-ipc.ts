import { ipcMain } from 'electron';
import { requireSession } from '../auth/session';
import { writeAudit } from '../audit/repository';
import type { AssetItemResult, AssetListResult } from '../shared/asset-types';
import { ipcChannels } from '../shared/ipc-channels';
import {
  archiveAsset,
  createAsset,
  getAssetById,
  isDuplicateError,
  listAssets,
  updateAsset,
} from './repository';
import { parseAssetId, parseAssetInput } from './validate';

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
    ipcChannels.assetCreate,
    async (_event, payload: unknown): Promise<AssetItemResult> => {
      if (!requireAuth()) {
        return { ok: false, error: 'unauthorized' };
      }

      const input = parseAssetInput(payload);

      if (!input) {
        return { ok: false, error: 'invalid_input' };
      }

      try {
        const asset = await createAsset(input);
        await writeAudit(
          'asset_create',
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
    ipcChannels.assetArchive,
    async (_event, payload: unknown): Promise<AssetItemResult> => {
      if (!requireAuth()) {
        return { ok: false, error: 'unauthorized' };
      }

      const id = parseAssetId(payload);

      if (!id) {
        return { ok: false, error: 'invalid_input' };
      }

      try {
        const asset = await archiveAsset(id);
        if (!asset) {
          return { ok: false, error: 'not_found' };
        }

        await writeAudit(
          'asset_archive',
          `${asset.hostname}${asset.ipAddress ? ` (${asset.ipAddress})` : ''}`,
        );
        return { ok: true, asset };
      } catch {
        return { ok: false, error: 'database_unavailable' };
      }
    },
  );
}
