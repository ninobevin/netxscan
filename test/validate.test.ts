import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseAssetId, parseAssetInput } from '../src/assets/validate';
import {
  parseCredentialId,
  parseCredentialLabel,
  parseCredentialPassword,
  parseCredentialUsername,
} from '../src/credentials/validate';
import {
  parseFindingFilter,
  parseFindingId,
  parseFindingNotes,
  parseFindingStatus,
} from '../src/findings/validate';
import {
  parseUninstallKey,
  parseUninstallMode,
} from '../src/windows/validate';
import { parseDatabaseConfig } from '../src/db/config';

describe('IPC input validation', () => {
  it('accepts a complete asset and rejects bad IP or MAC values', () => {
    const ok = parseAssetInput({
      hostname: 'clinic-pc',
      assetType: 'workstation',
      ipAddress: '192.168.10.20',
      macAddress: 'AA:BB:CC:DD:EE:FF',
      notes: 'front desk',
    });
    assert.equal(ok?.hostname, 'clinic-pc');
    assert.equal(
      parseAssetInput({
        hostname: 'clinic-pc',
        assetType: 'workstation',
        ipAddress: '999.0.0.1',
      }),
      null,
    );
    assert.equal(
      parseAssetInput({ hostname: '', assetType: 'workstation' }),
      null,
    );
    assert.equal(parseAssetId({ id: 'not-a-uuid' }), null);
    assert.equal(
      parseAssetId({ id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' }),
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    );
  });

  it('restricts credential labels and usernames', () => {
    assert.equal(parseCredentialLabel('Front desk PC'), 'Front desk PC');
    assert.equal(parseCredentialLabel('drop; table'), null);
    assert.equal(parseCredentialUsername('CLINIC\\tech'), 'CLINIC\\tech');
    assert.equal(parseCredentialUsername('user;whoami'), null);
    assert.equal(parseCredentialPassword('secret'), 'secret');
    assert.equal(parseCredentialPassword('a\0b'), null);
    assert.equal(
      parseCredentialId('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'),
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    );
  });

  it('accepts finding statuses and trims notes', () => {
    assert.equal(parseFindingStatus('accepted_risk'), 'accepted_risk');
    assert.equal(parseFindingStatus('closed'), null);
    assert.equal(parseFindingFilter('all'), 'all');
    assert.equal(parseFindingNotes('  patch Friday  '), 'patch Friday');
    assert.equal(parseFindingId('not-uuid'), null);
    assert.equal(parseUninstallMode('local'), 'local');
    assert.equal(parseUninstallKey('bad key!'), null);
    assert.equal(parseUninstallKey('{ABC-123}'), '{ABC-123}');
  });

  it('parses SQLite database config and rejects a path-like filename', () => {
    const sqlite = parseDatabaseConfig({ engine: 'sqlite' }, 'C:\\data');
    assert.equal(sqlite.engine, 'sqlite');
    if (sqlite.engine === 'sqlite') {
      assert.match(sqlite.filePath, /netxscan\.sqlite$/);
    }

    assert.throws(() =>
      parseDatabaseConfig({ engine: 'sqlite', file: '../escape.sqlite' }, 'C:\\data'),
    );
    assert.throws(() => parseDatabaseConfig({ engine: 'mysql' }, 'C:\\data'));
  });
});
