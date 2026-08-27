import type {
  NmapPortRow,
  NmapProtocolPayload,
  NmapSslRow,
} from '../shared/nmap-types';

function unescapeXml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#xa;/gi, '\n')
    .replace(/&#x0a;/gi, '\n')
    .replace(/&#10;/g, '\n')
    .replace(/&amp;/g, '&');
}

function attribute(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\b${name}="([^"]*)"`));
  return match?.[1] ? unescapeXml(match[1]) : null;
}

function parseScripts(block: string): Array<{ id: string; output: string }> {
  const scripts: Array<{ id: string; output: string }> = [];
  const re = /<script\b([^>]*)>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(block))) {
    const attrs = match[1] ?? '';
    const id = attribute(`x ${attrs}`, 'id');
    const output = attribute(`x ${attrs}`, 'output');
    if (id) {
      scripts.push({ id, output: output ?? '' });
    }
  }
  return scripts;
}

function parsePorts(xml: string): NmapPortRow[] {
  const ports: NmapPortRow[] = [];
  const re = /<port\b([^>]*)>([\s\S]*?)<\/port>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml))) {
    const open = match[1] ?? '';
    const inner = match[2] ?? '';
    const protocol = attribute(`port ${open}`, 'protocol') ?? 'tcp';
    const port = Number(attribute(`port ${open}`, 'portid'));
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      continue;
    }
    const stateTag = inner.match(/<state\b([^>]*)\/?>/);
    const state = stateTag
      ? (attribute(`state ${stateTag[1]}`, 'state') ?? 'unknown')
      : 'unknown';
    const serviceTag = inner.match(/<service\b([^>]*)\/?>/);
    const serviceAttrs = serviceTag?.[1] ?? '';
    ports.push({
      port,
      protocol,
      state,
      service: attribute(`s ${serviceAttrs}`, 'name'),
      product: attribute(`s ${serviceAttrs}`, 'product'),
      version: attribute(`s ${serviceAttrs}`, 'version'),
      scripts: parseScripts(inner),
    });
  }
  return ports;
}

function scriptOutput(
  scripts: Array<{ id: string; output: string }>,
  id: string,
): string | null {
  const found = scripts.find((script) => script.id === id);
  return found?.output ? found.output : null;
}

export function parseNmapXml(
  xml: string,
  hostname: string,
  ipAddress: string,
  extraNotes: string[],
): NmapProtocolPayload {
  const ports = parsePorts(xml);
  const hostScripts = parseScripts(
    xml.match(/<hostscript>([\s\S]*?)<\/hostscript>/)?.[1] ?? '',
  );
  const allScripts = [
    ...hostScripts,
    ...ports.flatMap((port) => port.scripts),
  ];

  const ssl: NmapSslRow[] = [];
  for (const port of ports) {
    const cert = scriptOutput(port.scripts, 'ssl-cert');
    const ciphers = scriptOutput(port.scripts, 'ssl-enum-ciphers');
    if (cert || ciphers) {
      ssl.push({ port: port.port, cert, ciphers });
    }
  }

  const notes = [...extraNotes];
  if (ports.length === 0) {
    notes.push('Nmap reported no ports in the scanned set.');
  }

  return {
    ipAddress,
    hostname,
    ranAt: new Date().toISOString(),
    ports,
    ssl,
    smbShares: scriptOutput(allScripts, 'smb-enum-shares'),
    smbSecurityMode: scriptOutput(allScripts, 'smb-security-mode'),
    notes,
  };
}
