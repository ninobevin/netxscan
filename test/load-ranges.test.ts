import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { loadAuthorizedRanges } from '../src/nmap/load-ranges';

describe('authorized network config files', () => {
  it('writes an example file when none exists, then reads listed CIDRs', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'netxscan-ranges-'));
    const configPath = path.join(dir, 'authorized-networks.json');

    try {
      const created = await loadAuthorizedRanges(configPath);
      assert.deepEqual(created, ['192.168.1.0/24']);
      const raw = await readFile(configPath, 'utf8');
      assert.match(raw, /192\.168\.1\.0\/24/);

      await writeFile(
        configPath,
        JSON.stringify({ ranges: ['10.20.0.0/16', '10.20.1.0/24'] }),
        'utf8',
      );
      const loaded = await loadAuthorizedRanges(configPath);
      assert.deepEqual(loaded, ['10.20.0.0/16', '10.20.1.0/24']);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('rejects a config that is not a CIDR list', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'netxscan-ranges-'));
    const configPath = path.join(dir, 'authorized-networks.json');

    try {
      await writeFile(configPath, JSON.stringify({ ranges: ['*'] }), 'utf8');
      await assert.rejects(() => loadAuthorizedRanges(configPath));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
