import { FormEvent, useEffect, useState } from 'react';
import type { ScanHost } from '../shared/scan-types';
import { BusyButton } from './BusyButton';

function scanErrorText(error: string): string {
  if (error === 'forbidden') {
    return 'Only administrators can ping authorized ranges.';
  }

  if (error === 'not_authorized_range') {
    return 'That target is outside the authorized network ranges.';
  }

  if (error === 'scan_in_progress') {
    return 'A ping is already running.';
  }

  if (error === 'invalid_input') {
    return 'Enter a single IPv4 address or a CIDR range between /16 and /32.';
  }

  if (error === 'unauthorized') {
    return 'Your session expired. Sign in again.';
  }

  return 'The ping could not be completed.';
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
  const [hosts, setHosts] = useState<ScanHost[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void window.netxscan.getAuthorizedRanges().then((result) => {
      if (result.ok) {
        setRanges(result.ranges);
        return;
      }

      setMessage(scanErrorText(result.error));
    });
  }, []);

  const runPing = async () => {
    setBusy(true);
    setMessage(null);
    setHosts([]);

    const result = await window.netxscan.runAuthorizedScan(target);
    setBusy(false);

    if (!result.ok) {
      setMessage(scanErrorText(result.error));
      return;
    }

    setHosts(result.hosts);
    onInventoryChanged();
    setMessage(
      `Ping finished. Saved ${result.savedCount ?? 0} live host(s). Hostnames come from ping -a; otherwise the IP is stored.`,
    );
  };

  return (
    <section className="app-card">
      <h2 className="text-lg font-semibold">Authorized ping</h2>
      <p className="text-sm text-health-subtle">
        Uses Windows ping -a on each host in the target (no Nmap). Live hosts
        are saved to inventory. Targets must be inside authorized-networks.json.
      </p>
      <p className="text-sm text-health-subtle">
        Authorized ranges: {ranges.length ? ranges.join(', ') : 'none configured'}
      </p>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          void runPing();
        }}
      >
        <label className="grid min-w-56 flex-1 gap-1 text-sm">
          <span className="font-medium text-health-subtle">Target</span>
          <input
            value={target}
            placeholder="192.168.1.0/24"
            onChange={(event) => setTarget(event.target.value)}
            disabled={!canScan || busy}
          />
        </label>
        <BusyButton
          type="submit"
          className="app-btn-primary"
          disabled={!canScan}
          busy={busy}
          busyLabel="Pinging…"
        >
          Ping
        </BusyButton>
      </form>
      {!canScan ? (
        <p className="text-sm text-health-subtle">
          Sign in as administrator to run a ping.
        </p>
      ) : null}
      {message ? (
        <p
          className={
            message.startsWith('Ping finished')
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
              ({host.ipAddress})
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
