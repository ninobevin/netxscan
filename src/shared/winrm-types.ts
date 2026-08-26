import type { Asset } from './asset-types';

export type WinrmAction = 'enable' | 'disable';

export type WinrmBatchError =
  | 'unauthorized'
  | 'forbidden'
  | 'invalid_input'
  | 'winrm_in_progress'
  | 'unavailable'
  | 'database_unavailable';

export type WinrmBatchResult =
  | { ok: true; processed: number }
  | { ok: false; error: WinrmBatchError };

export type WinrmProgress =
  | { type: 'running'; assetId: string }
  | {
      type: 'done';
      assetId: string;
      scOk: boolean;
      manageable: boolean;
      detail: string;
      asset: Asset | null;
    };
