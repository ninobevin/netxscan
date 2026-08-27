import { useEffect, useMemo, useState } from 'react';
import type { Asset } from '../shared/asset-types';
import type { NmapProtocolPayload } from '../shared/nmap-types';
import {
  AssetFilterBar,
  AssetSelect,
  EMPTY_ASSET_FILTERS,
  filterAssets,
  filterCatalog,
  type AssetFilters,
} from './asset-filters';
import { BusyButton } from './BusyButton';

type NmapScannerProps = {
  canRun: boolean;
};

function errorText(error: string): string {
  if (error === 'forbidden') {
    return 'Only administrators can run the Nmap scanner.';
  }
  if (error === 'not_authorized_range') {
    return 'That host is outside the authorized networks.';
  }
  if (error === 'nmap_missing') {
    return 'Nmap is not installed. Install Nmap and ensure nmap.exe is on PATH or in Program Files\\Nmap.';
  }
  if (error === 'scan_in_progress') {
    return 'A scan is already running.';
  }
  if (error === 'invalid_input') {
    return 'Select an asset with an IPv4 address.';
  }
  if (error === 'not_found') {
    return 'That asset was not found.';
  }
  if (error === 'unauthorized') {
    return 'Your session expired. Sign in again.';
  }
  return 'The scan could not be completed.';
}

export function NmapScanner({ canRun }: NmapScannerProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [filters, setFilters] = useState<AssetFilters>(EMPTY_ASSET_FILTERS);
  const [selectedId, setSelectedId] = useState('');
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<NmapProtocolPayload | null>(null);

  const filtered = useMemo(
    () => filterAssets(assets, filters),
    [assets, filters],
  );
  const catalog = useMemo(
    () => filterCatalog(groups, locations, assets),
    [assets, groups, locations],
  );
  const selected = filtered.find((asset) => asset.id === selectedId) ?? null;

  const load = async () => {
    const listed = await window.netxscan.listAssets(false);
    if (listed.ok) {
      setAssets(listed.assets);
    }
    const loc = await window.netxscan.listLocations();
    if (loc.ok) {
      setLocations(loc.locations);
    }
    const grp = await window.netxscan.listGroups();
    if (grp.ok) {
      setGroups(grp.groups);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (selectedId && !filtered.some((asset) => asset.id === selectedId)) {
      setSelectedId('');
      setResult(null);
    }
  }, [filtered, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setResult(null);
      return;
    }
    void (async () => {
      const loaded = await window.netxscan.getNmapProtocolResult(selectedId);
      if (loaded.ok) {
        setResult(loaded.result);
      }
    })();
  }, [selectedId]);

  const onScan = async () => {
    if (!canRun || !selectedId) {
      return;
    }
    setScanning(true);
    setMessage(null);
    const outcome = await window.netxscan.runNmapProtocolScan(selectedId);
    setScanning(false);
    if (!outcome.ok) {
      setMessage(errorText(outcome.error));
      return;
    }
    setResult(outcome.result);
  };

  if (!canRun) {
    return (
      <section className="app-card">
        <h2 className="text-lg font-semibold">Nmap scanner</h2>
        <p className="text-sm text-health-subtle">
          Sign in as administrator to scan an authorized asset.
        </p>
      </section>
    );
  }

  return (
    <div className="grid gap-6">
      <section className="app-card grid gap-4">
        <h2 className="text-lg font-semibold">Nmap scanner</h2>
        <p className="text-sm text-health-subtle">
          Scan one authorized IPv4 host for common ports, TLS certificates and
          ciphers, and SMB share/security mode. Nmap flags are fixed.
        </p>
        <AssetFilterBar
          filters={filters}
          onChange={setFilters}
          groups={catalog.groups}
          locations={catalog.locations}
        />
        <div className="flex flex-wrap items-end gap-3">
          <AssetSelect
            assets={filtered}
            value={selectedId}
            disabled={scanning}
            onChange={setSelectedId}
          />
          <BusyButton
            className="app-btn-primary"
            disabled={!selected}
            busy={scanning}
            busyLabel="Scanning…"
            onClick={() => {
              void onScan();
            }}
          >
            Scan
          </BusyButton>
        </div>
        {message ? (
          <p className="text-sm text-health-danger">{message}</p>
        ) : null}
      </section>

      {result ? (
        <>
          <section className="app-card overflow-x-auto">
            <h3 className="mb-2 font-semibold">Open and scanned ports</h3>
            <p className="mb-3 text-sm text-health-subtle">
              {result.hostname} ({result.ipAddress}) · {result.ranAt}
            </p>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-health-border text-health-subtle">
                  <th className="py-2 pr-3 font-medium">Port</th>
                  <th className="py-2 pr-3 font-medium">State</th>
                  <th className="py-2 pr-3 font-medium">Service</th>
                  <th className="py-2 font-medium">Product</th>
                </tr>
              </thead>
              <tbody>
                {result.ports.map((port) => (
                  <tr
                    key={`${port.protocol}-${port.port}`}
                    className="border-b border-health-border"
                  >
                    <td className="py-2 pr-3">
                      {port.port}/{port.protocol}
                    </td>
                    <td className="py-2 pr-3">{port.state}</td>
                    <td className="py-2 pr-3">{port.service ?? '—'}</td>
                    <td className="py-2">
                      {[port.product, port.version].filter(Boolean).join(' ') ||
                        '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="app-card">
            <h3 className="mb-2 font-semibold">SSL / TLS</h3>
            {result.ssl.length === 0 ? (
              <p className="text-sm text-health-subtle">
                No ssl-cert or ssl-enum-ciphers output on the scanned ports.
              </p>
            ) : (
              <div className="grid gap-4">
                {result.ssl.map((row) => (
                  <article key={row.port} className="grid gap-2">
                    <h4 className="text-sm font-medium">Port {row.port}</h4>
                    {row.cert ? (
                      <pre className="overflow-x-auto whitespace-pre-wrap text-xs">
                        {row.cert}
                      </pre>
                    ) : null}
                    {row.ciphers ? (
                      <pre className="overflow-x-auto whitespace-pre-wrap text-xs">
                        {row.ciphers}
                      </pre>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="app-card">
            <h3 className="mb-2 font-semibold">SMB shares and permissions</h3>
            {result.smbShares || result.smbSecurityMode ? (
              <div className="grid gap-3">
                {result.smbShares ? (
                  <pre className="overflow-x-auto whitespace-pre-wrap text-xs">
                    {result.smbShares}
                  </pre>
                ) : null}
                {result.smbSecurityMode ? (
                  <pre className="overflow-x-auto whitespace-pre-wrap text-xs">
                    {result.smbSecurityMode}
                  </pre>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-health-subtle">
                No SMB share or security-mode output (port 445 may be closed).
              </p>
            )}
          </section>

          {result.notes.length ? (
            <section className="app-card">
              <h3 className="mb-2 font-semibold">Notes</h3>
              <ul className="grid gap-1 text-sm text-health-subtle">
                {result.notes.map((note) => (
                  <li key={note.slice(0, 80)}>{note}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : selected ? (
        <p className="text-sm text-health-subtle">
          No saved scan for this asset yet. Run Scan.
        </p>
      ) : null}
    </div>
  );
}
