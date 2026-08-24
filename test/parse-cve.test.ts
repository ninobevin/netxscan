import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import dataset from '../src/cve/test-dataset.json';
import { applyCuratedProducts } from '../src/cve/fetch-online';
import {
  parseCveDocument,
  parseCveSearch,
  withSource,
} from '../src/cve/parse-cve';

describe('CVE catalog parsing', () => {
  it('accepts the bundled test dataset', () => {
    const parsed = parseCveDocument(dataset);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) {
      return;
    }

    assert.ok(parsed.cves.length > 0);
    const ids = parsed.cves.map((item) => item.id);
    assert.ok(ids.includes('CVE-2021-44228'));
    assert.ok(ids.includes('CVE-2014-3566'));
    assert.ok(ids.includes('CVE-2016-2118'));
  });

  it('rejects empty, oversized, or malformed catalogs', () => {
    assert.equal(parseCveDocument({ cves: [] }).ok, false);
    assert.equal(parseCveDocument({}).ok, false);
    assert.equal(
      parseCveDocument({
        cves: [
          {
            id: 'not-a-cve',
            title: 'x',
            description: 'y',
            severity: 'high',
          },
        ],
      }).ok,
      false,
    );
    assert.equal(
      parseCveDocument({
        cves: [
          {
            id: 'CVE-2021-44228',
            title: 'x',
            description: 'y',
            severity: 'urgent',
          },
        ],
      }).ok,
      false,
    );
  });

  it('trims search text and stamps import source', () => {
    assert.equal(parseCveSearch('  log4j  '), 'log4j');
    assert.equal(parseCveSearch('a'.repeat(80)).length, 64);
    const parsed = parseCveDocument(dataset);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) {
      return;
    }

    const stamped = withSource(parsed.cves, 'test', '2026-01-01T00:00:00.000Z');
    assert.equal(stamped[0]?.source, 'test');
    const merged = applyCuratedProducts([
      {
        id: 'CVE-2017-0144',
        products: [] as string[],
      },
    ]);
    assert.ok(merged[0]?.products.includes('smb'));
  });
});
