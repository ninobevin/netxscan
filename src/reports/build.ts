import { getDb } from '../db/client';
import { listAssets } from '../assets/repository';
import { mapLatestAssessments } from '../assess/repository';
import { listAudit } from '../audit/repository';
import { getCompanyProfile } from '../company/store';
import { listFindings } from '../findings/repository';
import { mapLatestWindowsAssessments } from '../windows/repository';
import type { ReportKind } from '../shared/report-types';
import { FINDING_STATUSES } from '../shared/finding-types';

function asIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

export function parseReportKind(value: unknown): ReportKind | null {
  return typeof value === 'string' &&
    [
      'assets',
      'findings',
      'assessments',
      'scans',
      'remediation',
      'audit',
    ].includes(value)
    ? (value as ReportKind)
    : null;
}

export async function listScanHistory(): Promise<
  Array<{
    kind: string;
    target: string;
    upCount: number;
    createdAt: string;
  }>
> {
  const db = getDb();
  const [rows] = await db.query(
    `SELECT kind, target, up_count, created_at
     FROM scan_history
     ORDER BY created_at DESC
     LIMIT 50`,
  );
  return (
    rows as Array<{
      kind: string;
      target: string;
      up_count: number;
      created_at: Date | string;
    }>
  ).map((row) => ({
    kind: row.kind,
    target: row.target,
    upCount: Number(row.up_count),
    createdAt: asIso(row.created_at),
  }));
}

export async function buildReportHtml(kind: ReportKind): Promise<{
  title: string;
  html: string;
}> {
  const company = await getCompanyProfile();
  const generatedAt = new Date().toISOString();
  const titles: Record<ReportKind, string> = {
    assets: 'Asset inventory report',
    findings: 'Vulnerability findings report',
    assessments: 'Security assessment report',
    scans: 'Scan history report',
    remediation: 'Remediation status report',
    audit: 'Audit activity report',
  };
  const title = titles[kind];
  const body = await reportBody(kind);
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(title)} — ${escapeHtml(company.companyName)}</title>
  <style>
    body { font-family: Segoe UI, Calibri, sans-serif; color: #1a3a3a; margin: 24px; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    .meta { color: #5c7373; font-size: 13px; margin-bottom: 20px; }
    table { border-collapse: collapse; width: 100%; font-size: 13px; }
    th, td { border: 1px solid #cfe3e3; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #eaf4f4; }
    .note { color: #5c7373; font-size: 12px; margin-top: 16px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p class="meta">${escapeHtml(company.companyName)} · NetXScan · generated ${escapeHtml(generatedAt)}</p>
  ${body}
  <p class="note">This report is for IT management and technical audit preparation. It does not include passwords. An open port is not treated as a CVE by itself.</p>
</body>
</html>`;

  return { title, html };
}

async function reportBody(kind: ReportKind): Promise<string> {
  if (kind === 'assets') {
    const assets = await listAssets(false);
    if (assets.length === 0) {
      return '<p>No active assets.</p>';
    }

    const rows = assets
      .map((asset) => {
        const services = asset.services
          .map((service) =>
            service.serviceName
              ? `${service.port}/${service.serviceName}`
              : String(service.port),
          )
          .join(', ');
        return `<tr>
          <td>${escapeHtml(asset.hostname)}</td>
          <td>${escapeHtml(asset.ipAddress ?? '—')}</td>
          <td>${escapeHtml(asset.assetType)}</td>
          <td>${escapeHtml(services || '—')}</td>
        </tr>`;
      })
      .join('');
    return `<table><thead><tr><th>Hostname</th><th>IP</th><th>Type</th><th>Services</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  if (kind === 'findings') {
    const findings = await listFindings('all');
    if (findings.length === 0) {
      return '<p>No findings stored.</p>';
    }

    const rows = findings
      .map(
        (item) => `<tr>
          <td>${escapeHtml(item.hostname)}</td>
          <td>${escapeHtml(item.cveId)}</td>
          <td>${escapeHtml(item.severity)}</td>
          <td>${escapeHtml(item.status)}</td>
          <td>${escapeHtml(item.evidence)}</td>
        </tr>`,
      )
      .join('');
    return `<table><thead><tr><th>Asset</th><th>CVE</th><th>Severity</th><th>Status</th><th>Evidence</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  if (kind === 'assessments') {
    const assets = await listAssets(false);
    const tlsMap = await mapLatestAssessments();
    const winMap = await mapLatestWindowsAssessments();
    const rows = assets
      .map((asset) => {
        const tls = tlsMap.get(asset.id);
        const win = winMap.get(asset.id);
        const tlsText = tls
          ? `443 open=${tls.tls.portOpen ? 'yes' : 'no'}; SMBv1=${
              tls.smb.smbv1Advertised === null
                ? 'n/a'
                : tls.smb.smbv1Advertised
                  ? 'yes'
                  : 'no'
            }; issues=${tls.issues.length}`
          : 'no service assessment';
        const winText = win
          ? `${win.facts.operatingSystem ?? 'Windows'} · ${win.facts.software.length} software`
          : 'no Windows facts';
        return `<tr>
          <td>${escapeHtml(asset.hostname)}</td>
          <td>${escapeHtml(asset.ipAddress ?? '—')}</td>
          <td>${escapeHtml(tlsText)}</td>
          <td>${escapeHtml(winText)}</td>
        </tr>`;
      })
      .join('');
    return rows
      ? `<table><thead><tr><th>Asset</th><th>IP</th><th>TLS/SMB facts</th><th>Windows facts</th></tr></thead><tbody>${rows}</tbody></table>`
      : '<p>No assets to assess.</p>';
  }

  if (kind === 'scans') {
    const scans = await listScanHistory();
    if (scans.length === 0) {
      return '<p>No scan history stored.</p>';
    }

    const rows = scans
      .map(
        (scan) => `<tr>
          <td>${escapeHtml(scan.createdAt)}</td>
          <td>${escapeHtml(scan.kind)}</td>
          <td>${escapeHtml(scan.target)}</td>
          <td>${scan.upCount}</td>
        </tr>`,
      )
      .join('');
    return `<table><thead><tr><th>When</th><th>Kind</th><th>Target</th><th>Hosts up</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  if (kind === 'remediation') {
    const findings = await listFindings('all');
    const counts = Object.fromEntries(
      FINDING_STATUSES.map((status) => [status, 0]),
    ) as Record<string, number>;
    for (const item of findings) {
      counts[item.status] += 1;
    }

    const rows = FINDING_STATUSES.map(
      (status) =>
        `<tr><td>${escapeHtml(status)}</td><td>${counts[status]}</td></tr>`,
    ).join('');
    return `<table><thead><tr><th>Status</th><th>Count</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  const entries = await listAudit('');
  if (entries.length === 0) {
    return '<p>No audit entries stored.</p>';
  }

  const rows = entries
    .map(
      (item) => `<tr>
        <td>${escapeHtml(item.createdAt)}</td>
        <td>${escapeHtml(item.username)}</td>
        <td>${escapeHtml(item.action)}</td>
        <td>${escapeHtml(item.detail)}</td>
      </tr>`,
    )
    .join('');
  return `<table><thead><tr><th>When</th><th>User</th><th>Action</th><th>Detail</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
