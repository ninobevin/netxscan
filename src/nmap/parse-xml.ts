import type { DiscoveredPort, NmapHost } from '../shared/scan-types';

function attr(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\b${name}="([^"]*)"`));
  return match?.[1] ?? null;
}

function parsePorts(block: string): DiscoveredPort[] {
  const ports: DiscoveredPort[] = [];
  const portTags = block.match(/<port\b[\s\S]*?<\/port>/g) ?? [];

  for (const portTag of portTags) {
    if (!/<state\b[^>]*\bstate="open"/.test(portTag)) {
      continue;
    }

    const portNumber = Number(attr(portTag, 'portid'));
    const protocol = attr(portTag, 'protocol') ?? 'tcp';

    if (!Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535) {
      continue;
    }

    const serviceTag = portTag.match(/<service\b[^>]*/)?.[0] ?? '';

    ports.push({
      port: portNumber,
      protocol,
      serviceName: attr(serviceTag, 'name'),
      product: attr(serviceTag, 'product'),
      version: attr(serviceTag, 'version'),
    });
  }

  return ports;
}

export function parseNmapXml(xml: string): NmapHost[] {
  const hosts: NmapHost[] = [];
  const hostBlocks = xml.match(/<host\b[\s\S]*?<\/host>/g) ?? [];

  for (const block of hostBlocks) {
    const statusMatch = block.match(/<status\b[^>]*\bstate="([^"]+)"/);
    const addressMatch = block.match(
      /<address\b[^>]*\baddr="(\d{1,3}(?:\.\d{1,3}){3})"[^>]*\baddrtype="ipv4"/,
    );
    const altAddressMatch = block.match(
      /<address\b[^>]*\baddrtype="ipv4"[^>]*\baddr="(\d{1,3}(?:\.\d{1,3}){3})"/,
    );
    const ip = addressMatch?.[1] ?? altAddressMatch?.[1];

    if (!ip) {
      continue;
    }

    const state = statusMatch?.[1];
    const status =
      state === 'up' || state === 'down' ? state : 'unknown';
    const macMatch = block.match(
      /<address\b[^>]*\baddr="([0-9A-Fa-f:]+)"[^>]*\baddrtype="mac"/,
    );
    const hostnameMatch = block.match(/<hostname\b[^>]*\bname="([^"]+)"/);

    hosts.push({
      ipAddress: ip,
      status,
      hostname: hostnameMatch?.[1] ?? null,
      macAddress: macMatch?.[1] ?? null,
      ports: parsePorts(block),
    });
  }

  return hosts;
}
