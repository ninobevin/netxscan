import { listAssets } from '../assets/repository';
import {
  SOFTWARE_CVE_CHECK_IDS,
  BASELINE_CHECKS,
} from '../assess/baseline-checks';
import { getModuleBySlug, getResult, listAllBaselineFindings } from '../assess/repository';
import { getDb } from '../db/client';
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

  const softwareNames = new Map<string, string[]>();
  const softwareModule = await getModuleBySlug('installed_software');
  if (softwareModule) {
    for (const asset of assets) {
      const result = await getResult(asset.id, softwareModule.id);
      softwareNames.set(asset.id, packageNames(result?.payloadJson ?? null));
    }
  }

  const cells: Record<string, Record<string, FindingCell>> = {};
  for (const asset of assets) {
    cells[asset.id] = {};
    const map = byAsset.get(asset.id);
    for (const check of BASELINE_CHECKS) {
      const found = map?.get(check.id);
      const status = found?.status ?? null;
      let cveIds: string[] = [];
      if (
        status &&
        (status === 'fail' || status === 'warn') &&
        SOFTWARE_CVE_CHECK_IDS.has(check.id)
      ) {
        cveIds = await matchCves(softwareNames.get(asset.id) ?? []);
      }
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

function packageNames(payloadJson: string | null): string[] {
  if (!payloadJson) {
    return [];
  }
  try {
    const parsed = JSON.parse(payloadJson) as {
      data?: { packages?: Array<{ name?: string }> };
    };
    const packages = parsed.data?.packages ?? [];
    return packages
      .map((item) => (typeof item.name === 'string' ? item.name.trim() : ''))
      .filter((name) => name.length >= 4)
      .slice(0, 40);
  } catch {
    return [];
  }
}

async function matchCves(names: string[]): Promise<string[]> {
  if (names.length === 0) {
    return [];
  }

  const ids = new Set<string>();
  const db = getDb();
  for (const name of names.slice(0, 12)) {
    const needle = name.slice(0, 48).replace(/[%_]/g, '');
    if (needle.length < 4) {
      continue;
    }
    try {
      const [rows] = await db.query(
        `SELECT cve_id FROM cves
         WHERE products_json LIKE :q OR title LIKE :q
         LIMIT 5`,
        { q: `%${needle}%` },
      );
      for (const row of rows as Array<{ cve_id: string }>) {
        ids.add(row.cve_id);
      }
    } catch {
      return [];
    }
    if (ids.size >= 12) {
      break;
    }
  }
  return [...ids];
}
