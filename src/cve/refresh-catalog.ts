import { writeAudit } from '../audit/repository';
import {
  applyCuratedProducts,
  fetchOnlineTestCves,
} from './fetch-online';
import testDataset from './test-dataset.json';
import { parseCveDocument, withSource } from './parse-cve';
import { listAllCves, upsertCves } from './repository';

export async function ensureCveCatalogForAssessment(): Promise<{
  catalogImported: number;
  catalogSource: 'online' | 'local';
}> {
  try {
    const cves = applyCuratedProducts(await fetchOnlineTestCves());
    const imported = await upsertCves(
      withSource(cves, 'online', new Date().toISOString()),
    );
    await writeAudit('cve_import', `online · ${imported} record(s) (assess)`);
    return { catalogImported: imported, catalogSource: 'online' };
  } catch {
    const existing = await listAllCves();
    if (existing.length > 0) {
      return { catalogImported: existing.length, catalogSource: 'local' };
    }

    const parsed = parseCveDocument(testDataset);
    if (!parsed.ok) {
      return { catalogImported: 0, catalogSource: 'local' };
    }

    const imported = await upsertCves(
      withSource(
        applyCuratedProducts(parsed.cves),
        'test',
        new Date().toISOString(),
      ),
    );
    await writeAudit(
      'cve_import',
      `test · ${imported} record(s) (assess fallback)`,
    );
    return { catalogImported: imported, catalogSource: 'local' };
  }
}
