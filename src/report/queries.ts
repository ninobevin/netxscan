import { listAssets } from '../assets/repository';
import { listAssessmentBatches } from '../adhics/repository';
import { DUMMY_REPORT_UNITS } from '../adhics/dummy-scripts';
import { getActiveSession } from '../auth/session';
import { getDb } from '../db/client';
import type {
  AssetListColumn,
  ReportPreview,
  ReportPreviewSection,
  ReportQuery,
} from '../shared/report-types';
import { ASSET_LIST_COLUMNS } from '../shared/report-types';

function str(value: unknown): string {
  return typeof value === 'string' ? value : String(value ?? '');
}

function num(value: unknown): number {
  return Number(value);
}

function dummyUnit(id: number): (typeof DUMMY_REPORT_UNITS)[number] {
  return DUMMY_REPORT_UNITS[Math.abs(id) % DUMMY_REPORT_UNITS.length];
}

function preparedBy() {
  const session = getActiveSession();
  return {
    fullName: session?.fullName.trim() || session?.username || 'IT incharge',
    position: session?.position.trim() || '',
  };
}

export function buildAssetListPreview(query: ReportQuery): ReportPreview {
  const allowed = new Set(ASSET_LIST_COLUMNS.map((item) => item.id));
  const columns = (query.columns?.filter((id) => allowed.has(id)) ??
    ASSET_LIST_COLUMNS.map((item) => item.id)) as AssetListColumn[];
  const order = columns.length > 0 ? columns : ASSET_LIST_COLUMNS.map((item) => item.id);
  const labels = Object.fromEntries(ASSET_LIST_COLUMNS.map((item) => [item.id, item.label]));
  let assets = listAssets();
  if (query.locationId) {
    assets = assets.filter((asset) => asset.locationId === query.locationId);
  }
  if (query.categoryId) {
    assets = assets.filter((asset) => asset.categoryId === query.categoryId);
  }
  const rows = assets.map((asset) => ({
    hostname: asset.hostname || '—',
    macAddress: asset.macAddress || '—',
    device: asset.categoryName || '—',
    ipv4: asset.ipv4,
    location: asset.locationName || '—',
  }));
  const section: ReportPreviewSection = {
    heading: '',
    columns: order.map((id) => ({ key: id, label: labels[id] })),
    rows,
  };
  return {
    kind: 'assets',
    title: 'Asset List',
    subtitle: '',
    showSignature: true,
    preparedBy: preparedBy(),
    sections: [section],
  };
}

export function buildBatchFindingsPreview(query: ReportQuery): ReportPreview {
  const outcome = query.outcome === 'pass' ? 'pass' : 'fail';
  const batches = listAssessmentBatches();
  const batch =
    (query.batchId
      ? batches.find((item) => item.id === query.batchId)
      : batches[0]) ?? null;
  if (!batch) {
    return {
      kind: 'findings',
      title: outcome === 'fail' ? 'Findings (failed)' : 'Findings (passed)',
      subtitle: '',
      showSignature: true,
      preparedBy: preparedBy(),
      sections: [],
    };
  }
  const rows = getDb()
    .prepare(
      `SELECT r.id, c.code AS control_code, c.title AS control_title,
              COALESCE(a.hostname, '') AS hostname,
              COALESCE(a.ipv4, '') AS ipv4,
              COALESCE(loc.name, '') AS location
         FROM assessment_results r
         JOIN assessment_scripts s ON s.id = r.script_id
         JOIN adhics_controls c ON c.id = s.control_id
         LEFT JOIN assets a ON a.id = r.asset_id
         LEFT JOIN locations loc ON loc.id = a.location_id
        WHERE r.batch_id = ? AND r.result = ?
        ORDER BY c.code, r.id`,
    )
    .all(batch.id, outcome);

  const grouped = new Map<string, ReportPreviewSection>();
  for (const row of rows) {
    const code = str(row.control_code);
    const title = str(row.control_title);
    const key = `${code} ${title}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        heading: key,
        columns: [
          { key: 'hostname', label: 'Hostname' },
          { key: 'ipv4', label: 'IP' },
          { key: 'location', label: 'Location' },
        ],
        rows: [],
      });
    }
    const dummy = dummyUnit(num(row.id));
    grouped.get(key)?.rows.push({
      hostname: str(row.hostname) || dummy.hostname,
      ipv4: str(row.ipv4) || dummy.ipv4,
      location: str(row.location) || dummy.location,
    });
  }

  const started = batch.startedAt.replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
  return {
    kind: 'findings',
    title: outcome === 'fail' ? 'Findings (failed)' : 'Findings (passed)',
    subtitle: `Batch ${batch.code} · ${started}`,
    showSignature: true,
    preparedBy: preparedBy(),
    sections: [...grouped.values()],
  };
}

export function buildCompliancePreview(query: ReportQuery): ReportPreview {
  const status = query.status && query.status !== 'all' ? query.status : null;
  const sql = status
    ? `SELECT f.id, c.code AS control_code, c.title AS control_title, f.title AS finding_title,
              f.status, COALESCE(a.hostname, '') AS hostname, COALESCE(a.ipv4, '') AS ipv4,
              COALESCE(loc.name, '') AS location
         FROM findings f
         JOIN assessment_scripts s ON s.id = f.script_id
         JOIN adhics_controls c ON c.id = s.control_id
         LEFT JOIN assets a ON a.id = f.asset_id
         LEFT JOIN locations loc ON loc.id = a.location_id
        WHERE f.status = ?
        ORDER BY c.code, f.id`
    : `SELECT f.id, c.code AS control_code, c.title AS control_title, f.title AS finding_title,
              f.status, COALESCE(a.hostname, '') AS hostname, COALESCE(a.ipv4, '') AS ipv4,
              COALESCE(loc.name, '') AS location
         FROM findings f
         JOIN assessment_scripts s ON s.id = f.script_id
         JOIN adhics_controls c ON c.id = s.control_id
         LEFT JOIN assets a ON a.id = f.asset_id
         LEFT JOIN locations loc ON loc.id = a.location_id
        ORDER BY c.code, f.id`;
  const rows = status ? getDb().prepare(sql).all(status) : getDb().prepare(sql).all();

  const grouped = new Map<string, ReportPreviewSection>();
  for (const row of rows) {
    const code = str(row.control_code);
    const title = str(row.control_title);
    const key = `${code} ${title}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        heading: key,
        columns: [
          { key: 'hostname', label: 'Hostname' },
          { key: 'ipv4', label: 'IP' },
          { key: 'location', label: 'Location' },
          { key: 'status', label: 'Status' },
          { key: 'finding', label: 'Finding' },
        ],
        rows: [],
      });
    }
    const dummy = dummyUnit(num(row.id));
    grouped.get(key)?.rows.push({
      hostname: str(row.hostname) || dummy.hostname,
      ipv4: str(row.ipv4) || dummy.ipv4,
      location: str(row.location) || dummy.location,
      status: str(row.status),
      finding: str(row.finding_title),
    });
  }

  const label =
    query.status && query.status !== 'all'
      ? `Compliance monitoring (${query.status})`
      : 'Compliance monitoring';
  return {
    kind: 'compliance',
    title: label,
    subtitle: query.status && query.status !== 'all' ? `Status: ${query.status}` : 'All statuses',
    showSignature: true,
    preparedBy: preparedBy(),
    sections: [...grouped.values()],
  };
}

export function buildReportPreview(query: ReportQuery): ReportPreview {
  if (query.kind === 'assets') {
    return buildAssetListPreview(query);
  }
  if (query.kind === 'findings') {
    return buildBatchFindingsPreview(query);
  }
  return buildCompliancePreview(query);
}
