import { getModuleBySlug, getResult } from '../assess/repository';
import { listAssets } from '../assets/repository';
import { fetchCvesForPrefix, searchCpes } from './client';
import {
  cpeIdentityFits,
  cpeProductPrefix,
  normalizeProductName,
  parseCpe23,
  searchKeyword,
  skipSoftwareInventory,
} from './cpe';
import { packagesFromPayload } from './match';
import {
  listCpePrefixes,
  upsertCpeCache,
  upsertNvdCve,
} from './repository';
import { getNvdApiKey } from './settings';

let syncing = false;

export function tryStartNvdSync(): boolean {
  if (syncing) {
    return false;
  }
  syncing = true;
  return true;
}

export function endNvdSync(): void {
  syncing = false;
}

function scoreCpe(
  inventoryName: string,
  keyword: string,
  publisher: string | undefined,
  cpeName: string,
  title: string,
): number {
  const parsed = parseCpe23(cpeName);
  if (!parsed || parsed.part !== 'a') {
    return -1;
  }
  if (!cpeIdentityFits(inventoryName, parsed.product, title)) {
    return -1;
  }
  let score = 1;
  const hay = `${title} ${parsed.product.replace(/_/g, ' ')}`.toLowerCase();
  for (const token of keyword.split(' ')) {
    if (token.length > 2 && hay.includes(token)) {
      score += 2;
    }
  }
  if (publisher) {
    const pub = publisher.toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (pub.length >= 4 && parsed.vendor.replace(/[^a-z0-9]+/g, '').includes(pub.slice(0, 8))) {
      score += 3;
    }
  }
  return score;
}

export async function collectInventoryKeywords(): Promise<
  Array<{ keyword: string; display: string; name: string; publisher?: string }>
> {
  const module = await getModuleBySlug('installed_software');
  if (!module) {
    return [];
  }
  const assets = await listAssets(false);
  const byKeyword = new Map<
    string,
    { keyword: string; display: string; name: string; publisher?: string }
  >();
  for (const asset of assets) {
    const result = await getResult(asset.id, module.id);
    for (const pkg of packagesFromPayload(result?.payloadJson ?? null)) {
      const name = pkg.name?.trim() ?? '';
      if (!name || skipSoftwareInventory(name)) {
        continue;
      }
      const keyword = normalizeProductName(name);
      const search = searchKeyword(name);
      if (!keyword || !search) {
        continue;
      }
      if (!byKeyword.has(keyword)) {
        byKeyword.set(keyword, {
          keyword,
          display: search,
          name,
          publisher: pkg.publisher,
        });
      }
    }
  }
  return [...byKeyword.values()];
}

export async function syncNvdCatalog(): Promise<{
  products: number;
  cpes: number;
  cves: number;
}> {
  const hasKey = Boolean(await getNvdApiKey());
  const limit = hasKey ? 25 : 12;
  const products = (await collectInventoryKeywords()).slice(0, limit);
  if (products.length === 0) {
    throw new Error('no_software');
  }

  let cpes = 0;
  for (const item of products) {
    const hits = await searchCpes(item.display);
    let best: { cpeName: string; title: string; score: number } | null = null;
    for (const hit of hits) {
      if (hit.deprecated) {
        continue;
      }
      const score = scoreCpe(
        item.name,
        item.keyword,
        item.publisher,
        hit.cpeName,
        hit.title,
      );
      if (score < 4) {
        continue;
      }
      if (!best || score > best.score) {
        best = { cpeName: hit.cpeName, title: hit.title, score };
      }
    }
    if (!best) {
      continue;
    }
    const parsed = parseCpe23(best.cpeName);
    const prefix = cpeProductPrefix(best.cpeName);
    if (!parsed || !prefix) {
      continue;
    }
    await upsertCpeCache({
      keyword: item.keyword,
      cpe23: best.cpeName,
      cpePrefix: prefix,
      title: best.title.slice(0, 255),
      vendor: parsed.vendor,
      product: parsed.product,
    });
    cpes += 1;
  }

  const prefixes = await listCpePrefixes();
  let cves = 0;
  for (const prefix of prefixes.slice(0, limit)) {
    const rows = await fetchCvesForPrefix(prefix);
    for (const row of rows) {
      await upsertNvdCve(row);
      cves += 1;
    }
  }

  return { products: products.length, cpes, cves };
}
