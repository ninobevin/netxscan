import type { SoftwareCveHit } from '../shared/nvd-types';
import {
  cpeAppliesToInstalled,
  cpeIdentityFits,
  normalizeProductName,
  skipSoftwareInventory,
} from './cpe';
import { getCpeByKeyword, listMatchesForProduct, replaceSoftwareHits } from './repository';

export type InventoryPackage = {
  name: string;
  version?: string;
  publisher?: string;
};

export async function evaluateInstalledSoftware(
  assetId: string,
  packages: InventoryPackage[],
): Promise<SoftwareCveHit[]> {
  const hits: SoftwareCveHit[] = [];
  const seen = new Set<string>();

  for (const pkg of packages) {
    const name = typeof pkg.name === 'string' ? pkg.name.trim() : '';
    const version = typeof pkg.version === 'string' ? pkg.version.trim() : '';
    if (!name || !version || skipSoftwareInventory(name)) {
      continue;
    }
    const keyword = normalizeProductName(name);
    if (!keyword) {
      continue;
    }
    const cpe = await getCpeByKeyword(keyword);
    if (!cpe) {
      continue;
    }
    if (!cpeIdentityFits(name, cpe.product, cpe.title)) {
      continue;
    }
    const matches = await listMatchesForProduct(cpe.vendor, cpe.product);
    for (const match of matches) {
      if (
        !cpeAppliesToInstalled(version, cpe.vendor, cpe.product, {
          criteria: match.criteria,
          vulnerable: match.vulnerable,
          versionStartIncluding: match.versionStartIncluding,
          versionStartExcluding: match.versionStartExcluding,
          versionEndIncluding: match.versionEndIncluding,
          versionEndExcluding: match.versionEndExcluding,
        })
      ) {
        continue;
      }
      const key = `${name}|${version}|${match.cveId}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      const cvssLabel =
        match.cvss === null ? 'n/a' : match.cvss.toFixed(1);
      hits.push({
        productName: name,
        productVersion: version,
        cveId: match.cveId,
        cvss: match.cvss,
        severity: match.severity,
        cpe23: cpe.cpe23,
        detail: `${match.cveId} CVSS ${cvssLabel} ${match.severity} · ${name} ${version} in affected range`,
        description: match.description || null,
      });
    }
  }

  await replaceSoftwareHits(assetId, hits);
  return hits;
}

export function packagesFromPayload(payloadJson: string | null): InventoryPackage[] {
  if (!payloadJson) {
    return [];
  }
  try {
    const parsed = JSON.parse(payloadJson) as {
      data?: { packages?: Array<{ name?: string; version?: string; publisher?: string }> };
    };
    return (parsed.data?.packages ?? []).map((item) => ({
      name: item.name ?? '',
      version: item.version,
      publisher: item.publisher,
    }));
  } catch {
    return [];
  }
}
