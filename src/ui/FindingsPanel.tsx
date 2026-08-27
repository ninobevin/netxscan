import { CheckCircle2, Minus, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FindingCell, FindingsMatrix } from '../shared/findings-types';

function CellMark({
  cell,
  onClick,
}: {
  cell: FindingCell;
  onClick: () => void;
}) {
  const status = cell.status;
  if (!status) {
    return (
      <button type="button" className="text-health-subtle" onClick={onClick}>
        <Minus className="mx-auto h-4 w-4" />
      </button>
    );
  }
  if (status === 'pass') {
    return (
      <button type="button" title="Compliant" onClick={onClick}>
        <CheckCircle2 className="mx-auto h-4 w-4 text-health-accent" />
      </button>
    );
  }
  if (status === 'fail') {
    return (
      <button type="button" title="Not compliant" onClick={onClick}>
        <XCircle className="mx-auto h-4 w-4 text-health-danger" />
      </button>
    );
  }
  return (
    <button type="button" title={status} onClick={onClick}>
      <Minus className="mx-auto h-4 w-4 text-amber-500" />
    </button>
  );
}

export function FindingsPanel() {
  const [matrix, setMatrix] = useState<FindingsMatrix | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);

  useEffect(() => {
    void window.netxscan.getFindingsMatrix().then((result) => {
      if (!result.ok) {
        setMessage('Could not load findings.');
        return;
      }
      setMatrix(result.matrix);
    });
  }, []);

  if (!matrix) {
    return (
      <section className="app-card">
        <h2 className="text-lg font-semibold">Findings</h2>
        <p className="text-sm text-health-subtle">{message ?? 'Loading…'}</p>
      </section>
    );
  }

  return (
    <section className="app-card overflow-x-auto">
      <h2 className="text-lg font-semibold">Findings</h2>
      <p className="mb-3 text-sm text-health-subtle">
        Click a cell for CVE IDs when installed software matched NVD CPE
        version ranges (apps_known_cves). Sync the NVD catalog in Settings
        first.
      </p>
      {detail ? (
        <p className="mb-3 text-sm">
          {detail}{' '}
          <button
            type="button"
            className="text-health-accent"
            onClick={() => setDetail(null)}
          >
            Dismiss
          </button>
        </p>
      ) : null}
      <table className="text-left text-xs">
        <thead>
          <tr className="border-b border-health-border">
            <th className="sticky left-0 z-10 bg-health-surface py-2 pr-3">
              Workstation
            </th>
            {matrix.checks.map((check) => (
              <th
                key={check.id}
                className="max-w-16 truncate px-1 py-2 font-medium text-health-subtle"
                title={check.title}
              >
                {check.id.replace(/_/g, '\u200b')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.hosts.map((host) => (
            <tr key={host.id} className="border-b border-health-border">
              <td className="sticky left-0 z-10 bg-health-surface py-1 pr-3 font-medium">
                {host.hostname}
              </td>
              {matrix.checks.map((check) => {
                const cell = matrix.cells[host.id]?.[check.id] ?? {
                  status: null,
                  cveIds: [],
                };
                return (
                  <td key={check.id} className="px-1 py-1 text-center">
                    <CellMark
                      cell={cell}
                      onClick={() => {
                        const cves =
                          cell.cveIds.length > 0
                            ? cell.cveIds.join(', ')
                            : 'No CVE in catalog';
                        setDetail(
                          `${host.hostname} · ${check.id}: ${cell.status ?? 'not collected'} · ${cves}`,
                        );
                      }}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
