import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { correlateAssets, type FactBundle } from '../src/correlate/engine';
import { parseCveDocument } from '../src/cve/parse-cve';
import dataset from '../src/cve/test-dataset.json';
import type { CveRecord } from '../src/shared/cve-types';

function manyAssets(count: number): FactBundle[] {
  return Array.from({ length: count }, (_, index) => ({
    assetId: `asset-${index}`,
    hostname: `host-${index}`,
    ipAddress: `192.168.10.${(index % 250) + 1}`,
    services: [
      {
        port: 443,
        protocol: 'tcp',
        serviceName: 'https',
        product: index % 7 === 0 ? 'OpenSSL' : null,
        version: index % 7 === 0 ? '1.0.1f' : null,
      },
    ],
    tls: null,
    smb:
      index % 11 === 0
        ? { portOpen: true, dialects: ['NT LM 0.12'], smbv1Advertised: true }
        : null,
    windows: null,
  }));
}

describe('performance of catalog parse and correlation', () => {
  it('parses the test catalog quickly', () => {
    const started = Date.now();
    for (let i = 0; i < 200; i += 1) {
      const parsed = parseCveDocument(dataset);
      assert.equal(parsed.ok, true);
    }
    assert.ok(Date.now() - started < 1000);
  });

  it('correlates hundreds of assets against the catalog in under a second', () => {
    const parsed = parseCveDocument(dataset);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) {
      return;
    }

    const cves: CveRecord[] = parsed.cves.map((item) => ({
      ...item,
      source: 'test',
      importedAt: '2026-01-01T00:00:00.000Z',
    }));
    const assets = manyAssets(300);
    const started = Date.now();
    const matches = correlateAssets(cves, assets);
    const elapsed = Date.now() - started;
    assert.ok(matches.length > 0);
    assert.ok(elapsed < 1000, `correlation took ${elapsed}ms`);
  });
});
