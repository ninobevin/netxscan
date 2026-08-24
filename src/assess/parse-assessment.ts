import type { SmbFacts, TlsFacts } from '../shared/assessment-types';

function decodeNmapText(value: string): string {
  return value
    .replace(/&#xa;/gi, '\n')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

function scriptOutput(xml: string, scriptId: string): string {
  const tag = new RegExp(
    `<script\\b[^>]*\\bid="${scriptId}"[^>]*\\boutput="([^"]*)"`,
    'i',
  );
  const fromAttr = xml.match(tag)?.[1];

  if (fromAttr) {
    return decodeNmapText(fromAttr);
  }

  const block = xml.match(
    new RegExp(
      `<script\\b[^>]*\\bid="${scriptId}"[^>]*>([\\s\\S]*?)</script>`,
      'i',
    ),
  );

  return block ? decodeNmapText(block[1]) : '';
}

function portIsOpen(xml: string, port: number): boolean {
  const block = xml.match(
    new RegExp(
      `<port\\b[^>]*\\bportid="${port}"[\\s\\S]*?</port>`,
      'i',
    ),
  );

  if (!block) {
    return false;
  }

  return /<state\b[^>]*\bstate="open"/i.test(block[0]);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function parseTlsFacts(xml: string): TlsFacts {
  const portOpen = portIsOpen(xml, 443);
  const cipherOutput = scriptOutput(xml, 'ssl-enum-ciphers');
  const certOutput = scriptOutput(xml, 'ssl-cert');

  const fromTables = unique(
    [...xml.matchAll(/<table\b[^>]*\bkey="(TLSv1\.[0-3])"/g)].map(
      (match) => match[1],
    ),
  );
  const tlsVersions = unique([
    ...[...cipherOutput.matchAll(/\b(TLSv1\.[0-3])\b/g)].map((match) => match[1]),
    ...fromTables,
  ]);

  const ciphers = unique(
    [...cipherOutput.matchAll(/\b(TLS_[A-Z0-9_]+|SSL_[A-Z0-9_]+)\b/g)].map(
      (match) => match[1],
    ),
  ).slice(0, 30);

  const subject =
    certOutput.match(/Subject:\s*(.+)/i)?.[1]?.trim() ??
    certOutput.match(/commonName=([^\s/]+)/i)?.[1] ??
    null;
  const issuer =
    certOutput.match(/Issuer:\s*(.+)/i)?.[1]?.trim() ?? null;
  const expires =
    certOutput.match(/Not valid after:\s*(.+)/i)?.[1]?.trim() ??
    certOutput.match(/until:\s*(.+)/i)?.[1]?.trim() ??
    null;

  return {
    portOpen,
    tlsVersions,
    ciphers,
    certificateSubject: subject,
    certificateIssuer: issuer,
    certificateExpires: expires,
  };
}

export function parseSmbFacts(xml: string): SmbFacts {
  const portOpen = portIsOpen(xml, 445);
  const output = scriptOutput(xml, 'smb-protocols');
  const dialects = unique(
    [...output.matchAll(/\b(\d+\.\d+|NT LM 0\.12|SMBv1)\b/gi)].map(
      (match) => match[1],
    ),
  );

  let smbv1Advertised: boolean | null = null;

  if (portOpen || output.length > 0) {
    smbv1Advertised =
      /SMBv1/i.test(output) || /NT LM 0\.12/i.test(output);
  }

  return {
    portOpen,
    dialects,
    smbv1Advertised,
  };
}

export function assessmentNotes(): string {
  return 'These are configuration facts from a controlled check. An open port or advertised protocol is not by itself a CVE finding.';
}
