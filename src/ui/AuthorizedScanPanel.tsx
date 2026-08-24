import { FormEvent, useEffect, useState } from 'react';
import type { NmapHost } from '../shared/scan-types';
import { BusyButton } from './BusyButton';

function scanErrorText(error: string): string {
  if (error === 'forbidden') {
    return 'Only administrators can run authorized scans.';
  }

  if (error === 'not_authorized_range') {
    return 'That target is outside the authorized network ranges.';
  }

  if (error === 'nmap_missing') {
    return 'Nmap was not found. Install Nmap and ensure it is on PATH.';
  }

  if (error === 'scan_in_progress') {
    return 'A scan is already running.';
  }

  if (error === 'timeout') {
    return 'The scan timed out.';
  }

  if (error === 'invalid_input') {
    return 'Enter a single IPv4 address or a CIDR range between /16 and /32.';
  }

  if (error === 'unauthorized') {
    return 'Your session expired. Sign in again.';
  }

  return 'The scan could not be completed.';
}

function portSummary(host: NmapHost): string {
  if (host.ports.length === 0) {
    return 'no open ports in the scanned set';
  }

  return host.ports
    .map((port) => {
      const label = port.serviceName ?? 'unknown';
      const version = [port.product, port.version].filter(Boolean).join(' ');
      return version
        ? `${port.port}/${port.protocol} ${label} (${version})`
        : `${port.port}/${port.protocol} ${label}`;
    })
    .join(', ');
}

type AuthorizedScanPanelProps = {
  canScan: boolean;
  onInventoryChanged: () => void;
};

export function AuthorizedScanPanel({
  canScan,
  onInventoryChanged,
}: AuthorizedScanPanelProps) {
  const [ranges, setRanges] = useState<string[]>([]);
  const [target, setTarget] = useState('');
  const [hosts, setHosts] = useState<NmapHost[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busyMode, setBusyMode] = useState<'discovery' | 'ping' | null>(null);

  useEffect(() => {
    void window.netxscan.getAuthorizedRanges().then((result) => {
      if (result.ok) {
        setRanges(result.ranges);
        return;
      }

      setMessage(scanErrorText(result.error));
    });
  }, []);

  const runScan = async (mode: 'ping' | 'discovery') => {
    setBusyMode(mode);
    setMessage(null);
    setHosts([]);

    const result =
      mode === 'discovery'
        ? await window.netxscan.runDiscoveryScan(target)
        : await window.netxscan.runAuthorizedScan(target);

    setBusyMode(null);

    if (!result.ok) {
      setMessage(scanErrorText(result.error));
      return;
    }

    const upHosts = result.hosts.filter((host) => host.status === 'up');
    setHosts(upHosts);

    onInventoryChanged();
    if (mode === 'discovery') {
      setMessage(
        `Saved ${result.savedCount ?? 0} live host(s) to the asset inventory.`,
      );
    } else {
      setMessage(
        `Ping finished. Saved ${result.savedCount ?? 0} live host(s); hostnames come from ping -a.`,
      );
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await runScan('discovery');
  };

  return (
    <section className="app-card">
      <h2 className="text-lg font-semibold">Authorized network discovery</h2>
      <p className="text-sm text-health-subtle">
        Discovery uses a fixed Nmap profile (TCP connect, light version
        detection, top 20 ports). Ping only uses Nmap host discovery, then
        Windows ping -a for hostnames, and saves those names without replacing
        open-port data. Targets must be inside authorized-networks.json.
        Live hosts are created or updated in inventory. This does not assess TLS
        or SMB and does not mark hosts as vulnerable.
      </p>
      <p className="text-sm text-health-subtle">
        Authorized ranges: {ranges.length ? ranges.join(', ') : 'none configured'}
      </p>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          void onSubmit(event);
        }}
      >
        <label className="grid min-w-56 flex-1 gap-1 text-sm">
          <span className="font-medium text-health-subtle">Target</span>
          <input
            value={target}
            placeholder="192.168.1.0/24"
            onChange={(event) => setTarget(event.target.value)}
            disabled={!canScan || busyMode !== null}
          />
        </label>
        <BusyButton
          type="submit"
          className="app-btn-primary"
          disabled={!canScan || busyMode === 'ping'}
          busy={busyMode === 'discovery'}
          busyLabel="Scanning…"
        >
          Run discovery scan
        </BusyButton>
        <BusyButton
          className="app-btn-secondary"
          disabled={!canScan || busyMode !== null}
          busy={busyMode === 'ping'}
          busyLabel="Pinging…"
          onClick={() => {
            void runScan('ping');
          }}
        >
          Ping only
        </BusyButton>
      </form>
      {!canScan ? (
        <p className="text-sm text-health-subtle">
          Sign in as administrator to run a scan.
        </p>
      ) : null}
      {message ? (
        <p
          className={
            message.startsWith('Saved')
              ? 'text-sm text-health-accent'
              : 'text-sm text-health-danger'
          }
        >
          {message}
        </p>
      ) : null}
      {hosts.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {hosts.map((host) => (
            <li key={host.ipAddress}>
              <span className="font-medium">
                {host.hostname ?? host.ipAddress}
              </span>{' '}
              ({host.ipAddress}
              {host.macAddress ? `, ${host.macAddress}` : ''}) —{' '}
              {portSummary(host)}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
