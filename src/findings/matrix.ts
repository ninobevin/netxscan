import { listAssets } from '../assets/repository';
import { BASELINE_CHECKS } from '../assess/baseline-checks';
import { listAllBaselineFindings } from '../assess/repository';
import { listSoftwareHitsByAsset } from '../nvd/repository';
import type { FindingCell, FindingsMatrix } from '../shared/findings-types';

export async function buildFindingsMatrix(): Promise<FindingsMatrix> {
  const assets = (await listAssets(false)).filter(
    (asset) => !asset.archivedAt,
  );
  const stored = await listAllBaselineFindings();
  const byAsset = new Map<string, Map<string, { status: string; detail: string }>>();
  for (const row of stored) {
    const map = byAsset.get(row.assetId) ?? new Map();
    map.set(row.checkId, { status: row.status, detail: row.detail });
    byAsset.set(row.assetId, map);
  }

  const cveByAsset = await listSoftwareHitsByAsset(
    assets.map((asset) => asset.id),
  );

  const cells: Record<string, Record<string, FindingCell>> = {};
  for (const asset of assets) {
    cells[asset.id] = {};
    const map = byAsset.get(asset.id);
    for (const check of BASELINE_CHECKS) {
      const found = map?.get(check.id);
      const status = found?.status ?? null;
      const cveIds =
        check.id === 'apps_known_cves' && status === 'fail'
          ? (cveByAsset.get(asset.id) ?? [])
          : [];
      cells[asset.id][check.id] = { status, cveIds };
    }
  }

  return {
    checks: BASELINE_CHECKS.map((check) => ({
      id: check.id,
      title: check.title,
    })),
    hosts: assets.map((asset) => ({
      id: asset.id,
      hostname: asset.hostname,
      ipAddress: asset.ipAddress,
    })),
    cells,
  };
}
