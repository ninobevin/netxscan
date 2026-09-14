import { getDb } from '../db/client';
import type {
  AdhicsControl,
  AdhicsDomain,
  AdhicsFamily,
  AdhicsFinding,
  AdhicsScript,
  ControlStatus,
  FindingSeverity,
  FindingStatus,
  LeafControlOption,
  ScriptResult,
  ScriptRunner,
} from '../shared/adhics-types';
import type { ReportControlSection, ReportDomainSection } from '../shared/report-types';
import { DUMMY_REPORT_UNITS } from './dummy-scripts';

const LEAF_CODE = /^[A-Za-z]{1,8}\s+\d+\.\d+$/;
const FAMILY_CODE = /^[A-Za-z]{1,8}\s+\d+$/;
const STATUSES: ControlStatus[] = ['mapped', 'gap', 'not_assessed'];
const RUNNERS: ScriptRunner[] = ['winrm', 'nmap'];
const RESULTS: ScriptResult[] = ['pass', 'fail'];
const FINDING_STATUSES: FindingStatus[] = ['open', 'acknowledged', 'closed'];
const SEVERITIES: FindingSeverity[] = ['critical', 'high', 'medium', 'low'];

function num(value: unknown): number {
  return Number(value);
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : String(value ?? '');
}

function asControlStatus(value: unknown): ControlStatus {
  return STATUSES.includes(value as ControlStatus) ? (value as ControlStatus) : 'not_assessed';
}

function asRunner(value: unknown): ScriptRunner {
  return RUNNERS.includes(value as ScriptRunner) ? (value as ScriptRunner) : 'winrm';
}

function asResult(value: unknown): ScriptResult | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  return RESULTS.includes(value as ScriptResult) ? (value as ScriptResult) : null;
}

function asFindingStatus(value: unknown): FindingStatus {
  return FINDING_STATUSES.includes(value as FindingStatus)
    ? (value as FindingStatus)
    : 'open';
}

function asSeverity(value: unknown): FindingSeverity {
  return SEVERITIES.includes(value as FindingSeverity) ? (value as FindingSeverity) : 'medium';
}

function mapScript(row: Record<string, unknown>): AdhicsScript {
  return {
    id: num(row.id),
    controlId: num(row.control_id),
    controlCode: str(row.control_code ?? row.code ?? ''),
    name: str(row.name),
    runner: asRunner(row.runner),
    enabled: Number(row.enabled) === 1,
    timeoutSec: num(row.timeout_sec),
    body: str(row.body),
    lastResult: asResult(row.last_result),
  };
}

function firstAssetId(): number | null {
  const row = getDb().prepare('SELECT id FROM assets ORDER BY id LIMIT 1').get();
  return row ? num(row.id) : null;
}

export function listAdhicsTree(): AdhicsDomain[] {
  const db = getDb();
  const domainRows = db
    .prepare('SELECT id, code, name FROM adhics_domains ORDER BY CAST(code AS INTEGER), code')
    .all();
  const familyRows = db
    .prepare(
      'SELECT id, domain_id, code, title FROM adhics_families ORDER BY domain_id, code',
    )
    .all();
  const controlRows = db
    .prepare(
      `SELECT c.id, c.family_id, c.code, c.title, c.tags, c.description, c.status,
              (SELECT COUNT(*) FROM assessment_scripts s WHERE s.control_id = c.id) AS script_count,
              (SELECT COUNT(*) FROM findings f
                 JOIN assessment_scripts s ON s.id = f.script_id
                WHERE s.control_id = c.id AND f.status != 'closed') AS finding_count
         FROM adhics_controls c
         ORDER BY c.family_id, c.code`,
    )
    .all();
  const scriptRows = db
    .prepare(
      `SELECT s.id, s.control_id, c.code AS control_code, s.name, s.runner, s.enabled,
              s.timeout_sec, s.body, s.last_result
         FROM assessment_scripts s
         JOIN adhics_controls c ON c.id = s.control_id
         ORDER BY c.code, s.name`,
    )
    .all();

  const scriptsByControl = new Map<number, AdhicsScript[]>();
  for (const row of scriptRows) {
    const script = mapScript(row);
    const list = scriptsByControl.get(script.controlId) ?? [];
    list.push(script);
    scriptsByControl.set(script.controlId, list);
  }

  const controlsByFamily = new Map<number, AdhicsControl[]>();
  for (const row of controlRows) {
    const id = num(row.id);
    const familyId = num(row.family_id);
    const control: AdhicsControl = {
      id,
      familyId,
      code: str(row.code),
      title: str(row.title),
      tags: str(row.tags),
      description: str(row.description),
      status: asControlStatus(row.status),
      scriptCount: num(row.script_count),
      findingCount: num(row.finding_count),
      scripts: scriptsByControl.get(id) ?? [],
    };
    const list = controlsByFamily.get(familyId) ?? [];
    list.push(control);
    controlsByFamily.set(familyId, list);
  }

  const familiesByDomain = new Map<number, AdhicsFamily[]>();
  for (const row of familyRows) {
    const id = num(row.id);
    const domainId = num(row.domain_id);
    const family: AdhicsFamily = {
      id,
      domainId,
      code: str(row.code),
      title: str(row.title),
      controls: controlsByFamily.get(id) ?? [],
    };
    const list = familiesByDomain.get(domainId) ?? [];
    list.push(family);
    familiesByDomain.set(domainId, list);
  }

  return domainRows.map((row) => ({
    id: num(row.id),
    code: str(row.code),
    name: str(row.name),
    families: familiesByDomain.get(num(row.id)) ?? [],
  }));
}

export function listLeafControls(): LeafControlOption[] {
  return getDb()
    .prepare(
      `SELECT c.id, c.code, c.title,
              'Domain ' || d.code || ' – ' || d.name AS domain_label
         FROM adhics_controls c
         JOIN adhics_families f ON f.id = c.family_id
         JOIN adhics_domains d ON d.id = f.domain_id
         ORDER BY CAST(d.code AS INTEGER), c.code`,
    )
    .all()
    .map((row) => ({
      id: num(row.id),
      code: str(row.code),
      title: str(row.title),
      domainLabel: str(row.domain_label),
    }));
}

export function listScripts(): AdhicsScript[] {
  return getDb()
    .prepare(
      `SELECT s.id, s.control_id, c.code AS control_code, s.name, s.runner, s.enabled,
              s.timeout_sec, s.body, s.last_result
         FROM assessment_scripts s
         JOIN adhics_controls c ON c.id = s.control_id
         ORDER BY c.code, s.name`,
    )
    .all()
    .map(mapScript);
}

export function saveDomain(input: { id?: number; code: string; name: string }): AdhicsDomain[] {
  const code = input.code.trim();
  const name = input.name.trim();
  if (!code || !name) {
    throw new Error('Domain code and name are required.');
  }
  const db = getDb();
  if (input.id) {
    db.prepare('UPDATE adhics_domains SET code = ?, name = ? WHERE id = ?').run(code, name, input.id);
  } else {
    db.prepare('INSERT INTO adhics_domains (code, name) VALUES (?, ?)').run(code, name);
  }
  return listAdhicsTree();
}

export function deleteDomain(id: number): AdhicsDomain[] {
  const child = getDb()
    .prepare('SELECT id FROM adhics_families WHERE domain_id = ? LIMIT 1')
    .get(id);
  if (child) {
    throw new Error('Cannot delete this domain while families still use it.');
  }
  getDb().prepare('DELETE FROM adhics_domains WHERE id = ?').run(id);
  return listAdhicsTree();
}

export function saveFamily(input: {
  id?: number;
  domainId: number;
  code: string;
  title: string;
}): AdhicsDomain[] {
  const code = input.code.trim();
  const title = input.title.trim();
  if (!FAMILY_CODE.test(code)) {
    throw new Error('Family code must look like CO 1.');
  }
  if (!title) {
    throw new Error('Family title is required.');
  }
  const db = getDb();
  const domain = db.prepare('SELECT id FROM adhics_domains WHERE id = ?').get(input.domainId);
  if (!domain) {
    throw new Error('Domain not found.');
  }
  if (input.id) {
    db.prepare('UPDATE adhics_families SET domain_id = ?, code = ?, title = ? WHERE id = ?').run(
      input.domainId,
      code,
      title,
      input.id,
    );
  } else {
    db.prepare('INSERT INTO adhics_families (domain_id, code, title) VALUES (?, ?, ?)').run(
      input.domainId,
      code,
      title,
    );
  }
  return listAdhicsTree();
}

export function deleteFamily(id: number): AdhicsDomain[] {
  const child = getDb()
    .prepare('SELECT id FROM adhics_controls WHERE family_id = ? LIMIT 1')
    .get(id);
  if (child) {
    throw new Error('Cannot delete this family while controls still use it.');
  }
  getDb().prepare('DELETE FROM adhics_families WHERE id = ?').run(id);
  return listAdhicsTree();
}

export function saveControl(input: {
  id?: number;
  familyId: number;
  code: string;
  title: string;
  tags: string;
  description: string;
  status: ControlStatus;
}): AdhicsDomain[] {
  const code = input.code.trim();
  const title = input.title.trim();
  if (!LEAF_CODE.test(code)) {
    throw new Error('Control ID must be a dotted leaf such as CO 1.2.');
  }
  if (!title) {
    throw new Error('Control title is required.');
  }
  const db = getDb();
  const family = db.prepare('SELECT id FROM adhics_families WHERE id = ?').get(input.familyId);
  if (!family) {
    throw new Error('Family not found.');
  }
  const status = asControlStatus(input.status);
  const tags = input.tags.trim();
  const description = input.description.trim();
  if (input.id) {
    db.prepare(
      `UPDATE adhics_controls
          SET family_id = ?, code = ?, title = ?, tags = ?, description = ?, status = ?
        WHERE id = ?`,
    ).run(input.familyId, code, title, tags, description, status, input.id);
  } else {
    db.prepare(
      `INSERT INTO adhics_controls (family_id, code, title, tags, description, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(input.familyId, code, title, tags, description, status);
  }
  return listAdhicsTree();
}

export function deleteControl(id: number): AdhicsDomain[] {
  const child = getDb()
    .prepare('SELECT id FROM assessment_scripts WHERE control_id = ? LIMIT 1')
    .get(id);
  if (child) {
    throw new Error('Cannot delete this control while scripts still use it.');
  }
  getDb().prepare('DELETE FROM adhics_controls WHERE id = ?').run(id);
  return listAdhicsTree();
}

function requireLeafControl(controlId: number): { id: number; code: string } {
  const row = getDb()
    .prepare('SELECT id, code FROM adhics_controls WHERE id = ?')
    .get(controlId);
  if (!row) {
    throw new Error('Control not found.');
  }
  const code = str(row.code);
  if (!LEAF_CODE.test(code)) {
    throw new Error('Scripts can only be assigned to a dotted control such as CO 1.2.');
  }
  return { id: num(row.id), code };
}

export function saveScript(input: {
  id?: number;
  controlId: number;
  name: string;
  runner: ScriptRunner;
  enabled: boolean;
  timeoutSec: number;
  body: string;
}): AdhicsScript[] {
  const name = input.name.trim();
  if (!name) {
    throw new Error('Script name is required.');
  }
  requireLeafControl(input.controlId);
  const runner = asRunner(input.runner);
  const enabled = input.enabled ? 1 : 0;
  const timeout = Math.max(1, Math.floor(input.timeoutSec) || 30);
  const body = input.body;
  const db = getDb();
  if (input.id) {
    db.prepare(
      `UPDATE assessment_scripts
          SET control_id = ?, name = ?, runner = ?, enabled = ?, timeout_sec = ?, body = ?
        WHERE id = ?`,
    ).run(input.controlId, name, runner, enabled, timeout, body, input.id);
    db.prepare('UPDATE findings SET title = ? WHERE script_id = ?').run(name, input.id);
  } else {
    db.prepare(
      `INSERT INTO assessment_scripts
        (control_id, name, runner, enabled, timeout_sec, body, last_result)
       VALUES (?, ?, ?, ?, ?, ?, NULL)`,
    ).run(input.controlId, name, runner, enabled, timeout, body);
  }
  return listScripts();
}

export function deleteScript(id: number): AdhicsScript[] {
  const db = getDb();
  db.prepare('DELETE FROM findings WHERE script_id = ?').run(id);
  db.prepare('DELETE FROM assessment_scripts WHERE id = ?').run(id);
  return listScripts();
}

export function setScriptResult(id: number, result: ScriptResult): AdhicsScript[] {
  if (!RESULTS.includes(result)) {
    throw new Error('Result must be pass or fail.');
  }
  const db = getDb();
  const script = db
    .prepare(
      `SELECT s.id, s.name, s.control_id FROM assessment_scripts s WHERE s.id = ?`,
    )
    .get(id);
  if (!script) {
    throw new Error('Script not found.');
  }
  db.prepare('UPDATE assessment_scripts SET last_result = ? WHERE id = ?').run(result, id);
  if (result === 'pass') {
    db.prepare('DELETE FROM findings WHERE script_id = ?').run(id);
  } else {
    const existing = db.prepare('SELECT id FROM findings WHERE script_id = ?').get(id);
    const assetId = firstAssetId();
    if (existing) {
      db.prepare(
        `UPDATE findings SET title = ?, status = 'open', asset_id = COALESCE(asset_id, ?)
          WHERE script_id = ?`,
      ).run(str(script.name), assetId, id);
    } else {
      db.prepare(
        `INSERT INTO findings (script_id, asset_id, title, severity, status)
         VALUES (?, ?, ?, 'medium', 'open')`,
      ).run(id, assetId, str(script.name));
    }
  }
  return listScripts();
}

export function listFindings(): AdhicsFinding[] {
  return getDb()
    .prepare(
      `SELECT f.id, f.script_id, c.id AS control_id, c.code AS control_code,
              'Domain ' || d.code || ' – ' || d.name AS domain_label,
              f.title, f.severity, f.status, f.asset_id,
              a.hostname, a.ipv4, c.description
         FROM findings f
         JOIN assessment_scripts s ON s.id = f.script_id
         JOIN adhics_controls c ON c.id = s.control_id
         JOIN adhics_families fam ON fam.id = c.family_id
         JOIN adhics_domains d ON d.id = fam.domain_id
         LEFT JOIN assets a ON a.id = f.asset_id
         ORDER BY d.code, c.code, f.id`,
    )
    .all()
    .map((row) => ({
      id: num(row.id),
      scriptId: num(row.script_id),
      controlId: num(row.control_id),
      controlCode: str(row.control_code),
      domainLabel: str(row.domain_label),
      title: str(row.title),
      severity: asSeverity(row.severity),
      status: asFindingStatus(row.status),
      assetId: row.asset_id === null || row.asset_id === undefined ? null : num(row.asset_id),
      hostname: row.hostname === null || row.hostname === undefined ? null : str(row.hostname),
      ipv4: row.ipv4 === null || row.ipv4 === undefined ? null : str(row.ipv4),
      description: str(row.description),
    }));
}

export function updateFindingStatus(id: number, status: FindingStatus): AdhicsFinding[] {
  if (!FINDING_STATUSES.includes(status)) {
    throw new Error('Invalid finding status.');
  }
  const row = getDb().prepare('SELECT id FROM findings WHERE id = ?').get(id);
  if (!row) {
    throw new Error('Finding not found.');
  }
  getDb().prepare('UPDATE findings SET status = ? WHERE id = ?').run(status, id);
  return listFindings();
}

export function buildReportSections(): ReportDomainSection[] {
  const rows = getDb()
    .prepare(
      `SELECT f.id AS finding_id,
              'Domain ' || d.code || ' – ' || d.name AS domain_label,
              c.code AS control_code, c.title AS control_title,
              COALESCE(a.hostname, a.ipv4, '') AS hostname,
              COALESCE(a.ipv4, '') AS ipv4,
              COALESCE(cat.name, '') AS device,
              COALESCE(loc.name, '') AS location,
              f.title AS finding_title
         FROM findings f
         JOIN assessment_scripts s ON s.id = f.script_id
         JOIN adhics_controls c ON c.id = s.control_id
         JOIN adhics_families fam ON fam.id = c.family_id
         JOIN adhics_domains d ON d.id = fam.domain_id
         LEFT JOIN assets a ON a.id = f.asset_id
         LEFT JOIN categories cat ON cat.id = a.category_id
         LEFT JOIN locations loc ON loc.id = a.location_id
        WHERE f.status != 'closed'
        ORDER BY CAST(d.code AS INTEGER), c.code, hostname`,
    )
    .all();

  const domains = new Map<string, Map<string, ReportControlSection>>();
  for (const row of rows) {
    const domain = str(row.domain_label);
    const controlCode = str(row.control_code);
    const title = str(row.control_title);
    if (!domains.has(domain)) {
      domains.set(domain, new Map());
    }
    const controls = domains.get(domain);
    if (!controls) {
      continue;
    }
    if (!controls.has(controlCode)) {
      controls.set(controlCode, { controlId: controlCode, title, units: [] });
    }
    const section = controls.get(controlCode);
    if (!section) {
      continue;
    }
    const dummy = DUMMY_REPORT_UNITS[num(row.finding_id) % DUMMY_REPORT_UNITS.length];
    const hostname = str(row.hostname) || dummy.hostname;
    const ipv4 = str(row.ipv4) || dummy.ipv4;
    const key = `${hostname}|${ipv4}`;
    const existing = section.units.find((unit) => `${unit.hostname}|${unit.ipv4}` === key);
    const findingTitle = str(row.finding_title);
    if (existing) {
      if (!existing.findings.split('; ').includes(findingTitle)) {
        existing.findings = `${existing.findings}; ${findingTitle}`;
      }
    } else {
      section.units.push({
        hostname,
        ipv4,
        device: str(row.device) || dummy.device,
        location: str(row.location) || dummy.location,
        findings: findingTitle,
      });
    }
  }

  return [...domains.entries()].map(([domain, controls]) => ({
    domain,
    controls: [...controls.values()].filter((control) => control.units.length > 0),
  })).filter((section) => section.controls.length > 0);
}
