import type { AssetService } from '../shared/asset-types';
import type { SmbFacts, TlsFacts } from '../shared/assessment-types';
import type { CveRecord } from '../shared/cve-types';
import type { WindowsFacts } from '../shared/windows-types';

export type FactBundle = {
  assetId: string;
  hostname: string;
  ipAddress: string | null;
  services: AssetService[];
  tls: TlsFacts | null;
  smb: SmbFacts | null;
  windows: WindowsFacts | null;
};

export type EngineMatch = {
  assetId: string;
  hostname: string;
  ipAddress: string | null;
  cveId: string;
  title: string;
  severity: CveRecord['severity'];
  evidence: string;
  recommendation: string;
  description: string;
};

const HANDLED = new Set([
  'openssl',
  'smb',
  'print',
  'log4j',
  'exchange',
  'spring',
  'windows',
  'java',
  'http2',
]);

const RECOMMENDATION =
  'Review the listed evidence and apply the vendor patch if that component is still in use. An open port or service name alone is not treated as a CVE. NetXScan does not exploit the issue.';

export function correlateAssets(
  cves: CveRecord[],
  assets: FactBundle[],
): EngineMatch[] {
  const matches: EngineMatch[] = [];

  for (const asset of assets) {
    for (const cve of cves) {
      const lines = evidenceFor(cve, asset);
      if (lines.length === 0) {
        continue;
      }

      matches.push({
        assetId: asset.assetId,
        hostname: asset.hostname,
        ipAddress: asset.ipAddress,
        cveId: cve.id,
        title: cve.title,
        severity: cve.severity,
        evidence: lines.join(' '),
        recommendation: RECOMMENDATION,
        description: cve.description,
      });
    }
  }

  return matches;
}

function evidenceFor(cve: CveRecord, asset: FactBundle): string[] {
  const products = new Set(cve.products.map((item) => item.toLowerCase()));
  const lines: string[] = [];

  if (products.has('openssl')) {
    lines.push(...opensslEvidence(asset));
  }

  if (products.has('smb')) {
    lines.push(...smbEvidence(asset));
  }

  if (products.has('print')) {
    lines.push(
      ...softwareEvidence(asset, /print\s*spooler/i, 'Print Spooler software'),
    );
  }

  if (products.has('log4j')) {
    lines.push(...softwareEvidence(asset, /log4j/i, 'Log4j software'));
    lines.push(...versionedServiceEvidence(asset, /log4j/i));
  }

  if (products.has('exchange')) {
    lines.push(
      ...softwareEvidence(
        asset,
        /exchange\s+server/i,
        'Microsoft Exchange Server software',
      ),
    );
    lines.push(...versionedServiceEvidence(asset, /exchange/i));
  }

  if (products.has('spring')) {
    lines.push(...softwareEvidence(asset, /\bspring\b/i, 'Spring software'));
    lines.push(...versionedServiceEvidence(asset, /\bspring\b/i));
  }

  for (const token of products) {
    if (HANDLED.has(token) || token.length < 5) {
      continue;
    }

    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\b${escaped}\\b`, 'i');
    lines.push(...softwareEvidence(asset, pattern, `${token} software`));
    lines.push(...versionedServiceEvidence(asset, pattern));
  }

  return unique(lines);
}

function opensslEvidence(asset: FactBundle): string[] {
  const lines: string[] = [];
  const subject = asset.tls?.certificateSubject ?? '';
  const issuer = asset.tls?.certificateIssuer ?? '';

  if (/openssl/i.test(subject) || /openssl/i.test(issuer)) {
    lines.push(
      `TLS certificate text names OpenSSL (subject or issuer). Port 443 being open was not used as the reason.`,
    );
  }

  lines.push(...versionedServiceEvidence(asset, /openssl/i));
  return lines;
}

function smbEvidence(asset: FactBundle): string[] {
  if (asset.smb?.smbv1Advertised !== true) {
    return [];
  }

  const dialects =
    asset.smb.dialects.length > 0
      ? asset.smb.dialects.join(', ')
      : 'SMBv1';
  return [
    `SMBv1 is advertised (${dialects}). Port 445 being open was not used as the reason.`,
  ];
}

function softwareEvidence(
  asset: FactBundle,
  pattern: RegExp,
  label: string,
): string[] {
  if (!asset.windows) {
    return [];
  }

  const hits = asset.windows.software
    .filter((item) => pattern.test(item.name))
    .slice(0, 5)
    .map((item) =>
      item.version ? `${item.name} ${item.version}` : item.name,
    );

  if (hits.length === 0) {
    return [];
  }

  return [`${label} listed: ${hits.join('; ')}.`];
}

function versionedServiceEvidence(
  asset: FactBundle,
  pattern: RegExp,
): string[] {
  const hits = asset.services
    .filter(
      (service) =>
        Boolean(service.product) &&
        pattern.test(service.product ?? '') &&
        Boolean(service.version?.trim()),
    )
    .slice(0, 5)
    .map(
      (service) =>
        `${service.product} ${service.version} on ${service.port}/${service.protocol}`,
    );

  if (hits.length === 0) {
    return [];
  }

  return [
    `Identified service product and version: ${hits.join('; ')}. An open port without a product version was not used.`,
  ];
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
