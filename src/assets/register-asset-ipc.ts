import { ipcMain } from 'electron';
import { requireSession } from '../auth/session';
import { writeAudit } from '../audit/repository';
import type {
  AssetDeleteManyResult,
  AssetItemResult,
  AssetListResult,
  GroupListResult,
  LocationListResult,
} from '../shared/asset-types';
import { ipcChannels } from '../shared/ipc-channels';
import { addLocationName, deleteLocationName, listLocationNames } from './locations';
import {
  addGroupName,
  deleteGroupName,
  listGroupNames,
  renameGroupName,
} from './groups';
import {
  deleteAsset,
  getAssetById,
  isDuplicateError,
  listAssets,
  updateAsset,
} from './repository';
import {
  parseAssetId,
  parseAssetIds,
  parseAssetInput,
  parseLocationName,
  parseRenameNames,
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
    ipcChannels.assetDeleteMany,
    async (_event, payload: unknown): Promise<AssetDeleteManyResult> => {
      if (!requireAuth()) {
        return { ok: false, error: 'unauthorized' };
      }

      const ids = parseAssetIds(payload);
      if (!ids) {
        return { ok: false, error: 'invalid_input' };
      }

      try {
        const deletedIds: string[] = [];
        for (const id of ids) {
          const asset = await deleteAsset(id);
          if (!asset) {
            continue;
          }

          await writeAudit(
            'asset_delete',
            `${asset.hostname}${asset.ipAddress ? ` (${asset.ipAddress})` : ''}`,
          );
          deletedIds.push(id);
        }

        return { ok: true, deletedIds };
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

  ipcMain.handle(
    ipcChannels.locationDelete,
    async (_event, payload: unknown): Promise<LocationListResult> => {
      if (!requireAuth()) {
        return { ok: false, error: 'unauthorized' };
      }

      const name = parseLocationName(payload);
      if (!name) {
        return { ok: false, error: 'invalid_input' };
      }

      try {
        const locations = await deleteLocationName(name);
        await writeAudit('location_delete', name);
        return { ok: true, locations };
      } catch {
        return { ok: false, error: 'database_unavailable' };
      }
    },
  );

  ipcMain.handle(
    ipcChannels.groupList,
    async (): Promise<GroupListResult> => {
      if (!requireAuth()) {
        return { ok: false, error: 'unauthorized' };
      }

      try {
        const groups = await listGroupNames();
        return { ok: true, groups };
      } catch {
        return { ok: false, error: 'database_unavailable' };
      }
    },
  );

  ipcMain.handle(
    ipcChannels.groupAdd,
    async (_event, payload: unknown): Promise<GroupListResult> => {
      if (!requireAuth()) {
        return { ok: false, error: 'unauthorized' };
      }

      const name = parseLocationName(payload);
      if (!name) {
        return { ok: false, error: 'invalid_input' };
      }

      try {
        const groups = await addGroupName(name);
        await writeAudit('group_add', name);
        return { ok: true, groups };
      } catch {
        return { ok: false, error: 'database_unavailable' };
      }
    },
  );

  ipcMain.handle(
    ipcChannels.groupRename,
    async (_event, payload: unknown): Promise<GroupListResult> => {
      if (!requireAuth()) {
        return { ok: false, error: 'unauthorized' };
      }

      const names = parseRenameNames(payload);
      if (!names) {
        return { ok: false, error: 'invalid_input' };
      }

      try {
        const groups = await renameGroupName(names.name, names.newName);
        await writeAudit('group_rename', `${names.name} -> ${names.newName}`);
        return { ok: true, groups };
      } catch {
        return { ok: false, error: 'database_unavailable' };
      }
    },
  );

  ipcMain.handle(
    ipcChannels.groupDelete,
    async (_event, payload: unknown): Promise<GroupListResult> => {
      if (!requireAuth()) {
        return { ok: false, error: 'unauthorized' };
      }

      const name = parseLocationName(payload);
      if (!name) {
        return { ok: false, error: 'invalid_input' };
      }

      try {
        const groups = await deleteGroupName(name);
        await writeAudit('group_delete', name);
        return { ok: true, groups };
      } catch {
        return { ok: false, error: 'database_unavailable' };
      }
    },
  );
}
