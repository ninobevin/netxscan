import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { login } from '../src/auth/login';
import { clearSession } from '../src/auth/session';
import { initializeUserStore } from '../src/auth/user-store';
import { createAsset } from '../src/assets/repository';
import { writeAudit, listAudit, parseAuditSearch } from '../src/audit/repository';
import { upsertCves, listCves } from '../src/cve/repository';
import { parseCveDocument, withSource } from '../src/cve/parse-cve';
import dataset from '../src/cve/test-dataset.json';
import {
  listFindings,
  updateFinding,
  upsertFindingsFromMatches,
} from '../src/findings/repository';
import { getDb, withSqlite } from './helpers/temp-db';
import type { EngineMatch } from '../src/correlate/engine';

describe('SQLite schema and repositories', () => {
  it('migrates, bootstraps users, and stores assets without a password column', async () => {
    await withSqlite(async () => {
      await initializeUserStore();
      const db = getDb();
      const [tables] = await db.query(
        `SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`,
      );
      const names = (tables as Array<{ name: string }>).map((row) => row.name);
      assert.ok(names.includes('users'));
      assert.ok(names.includes('assets'));
      assert.ok(names.includes('findings'));
      assert.ok(names.includes('audit_log'));
      assert.ok(names.includes('cves'));

      const [columns] = await db.query(`PRAGMA table_info(users)`);
      const userCols = (columns as Array<{ name: string }>).map((row) => row.name);
      assert.ok(userCols.includes('password_hash'));
      assert.equal(userCols.includes('password'), false);

      const asset = await createAsset({
        hostname: 'clinic-pc',
        ipAddress: '192.168.10.20',
        macAddress: null,
        assetType: 'workstation',
        notes: null,
      });
      assert.equal(asset.hostname, 'clinic-pc');

      await assert.rejects(() =>
        createAsset({
          hostname: 'other',
          ipAddress: '192.168.10.20',
          macAddress: null,
          assetType: 'workstation',
          notes: null,
        }),
      );
    });
  });

  it('imports catalog CVEs and creates one finding per asset and CVE', async () => {
    await withSqlite(async () => {
      const asset = await createAsset({
        hostname: 'clinic-pc',
        ipAddress: '192.168.10.21',
        macAddress: null,
        assetType: 'workstation',
        notes: null,
      });
      const parsed = parseCveDocument(dataset);
      assert.equal(parsed.ok, true);
      if (!parsed.ok) {
        return;
      }

      const imported = await upsertCves(
        withSource(parsed.cves, 'test', new Date().toISOString()),
      );
      assert.ok(imported > 0);
      const listed = await listCves('log4j');
      assert.ok(listed.some((item) => item.id === 'CVE-2021-44228'));

      const match: EngineMatch = {
        assetId: asset.id,
        hostname: asset.hostname,
        ipAddress: asset.ipAddress,
        cveId: 'CVE-2021-44228',
        title: 'Log4Shell',
        severity: 'critical',
        evidence: 'Apache Log4j 2.14.1 listed.',
        recommendation: 'Apply the vendor patch.',
        description: 'catalog',
      };

      const first = await upsertFindingsFromMatches([match]);
      assert.equal(first.created, 1);
      const second = await upsertFindingsFromMatches([match]);
      assert.equal(second.created, 0);
      assert.equal(second.updated, 1);

      const open = await listFindings('open');
      assert.equal(open.length, 1);
      const resolved = await updateFinding(open[0]!.id, 'resolved', 'patched');
      assert.equal(resolved?.status, 'resolved');
      assert.ok(resolved?.resolvedAt);

      await upsertFindingsFromMatches([match]);
      const reopened = await listFindings('open');
      assert.equal(reopened.length, 1);

      await updateFinding(reopened[0]!.id, 'accepted_risk', 'compensating control');
      await upsertFindingsFromMatches([match]);
      const accepted = await listFindings('accepted_risk');
      assert.equal(accepted.length, 1);
      const stillOpen = await listFindings('open');
      assert.equal(stillOpen.length, 0);
    });
  });

  it('writes audit rows without storing a password in the detail', async () => {
    await withSqlite(async () => {
      assert.equal(parseAuditSearch('  login  '), 'login');
      await writeAudit('login', 'Signed in.', 'admin');
      await writeAudit('credential_save', 'Saved label Front desk', 'admin');
      const rows = await listAudit('login');
      assert.equal(rows.length, 1);
      assert.equal(rows[0]?.username, 'admin');
      assert.doesNotMatch(JSON.stringify(rows), /Admin123!/);
    });
  });

  it('authenticates bootstrap admin and rejects a bad password', async () => {
    await withSqlite(async () => {
      await initializeUserStore();
      clearSession();
      const ok = await login({ username: 'admin', password: 'Admin123!' });
      assert.equal(ok.ok, true);
      if (ok.ok) {
        assert.equal(ok.session.role, 'administrator');
      }

      const bad = await login({ username: 'admin', password: 'nope' });
      assert.equal(bad.ok, false);
      if (!bad.ok) {
        assert.equal(bad.error, 'invalid_credentials');
      }

      const invalid = await login({ username: '', password: '' });
      assert.equal(invalid.ok, false);
      clearSession();
    });
  });
});
